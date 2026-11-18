import { Router } from 'express';
import { z } from 'zod';
import { getAgentDeviceId } from '../config.js';
import { bearerToken } from './auth.js';

const uuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const utcSchema = z.string().datetime({ offset: true });
const volumeSchema = z.object({
  name: z.string().min(1).max(64),
  totalBytes: z.number().int().nonnegative(),
  freeBytes: z.number().int().nonnegative()
}).strict().refine((volume) => volume.freeBytes <= volume.totalBytes, 'freeBytes no puede superar totalBytes');
const inventorySchema = z.object({
  schemaVersion: z.literal(1),
  inventoryId: uuidSchema,
  deviceId: uuidSchema,
  computerName: z.string().trim().min(1).max(256),
  collectedAtUtc: utcSchema,
  cpuModels: z.array(z.string().max(256)).max(64),
  ramInstalledBytes: z.number().int().nonnegative().nullable(),
  serialNumber: z.string().max(128).nullable(),
  consoleUser: z.string().max(256).nullable(),
  volumes: z.array(volumeSchema).max(128),
  errors: z.array(z.string().max(1024)).max(100)
}).strict();
const heartbeatSchema = z.object({
  schemaVersion: z.literal(1),
  deviceId: uuidSchema,
  sentAtUtc: utcSchema
}).strict();
const activitySchema = z.object({
  schemaVersion: z.literal(1),
  batchId: uuidSchema,
  collectorId: uuidSchema,
  sessionId: z.number().int().nonnegative(),
  startedAtUtc: utcSchema,
  endedAtUtc: utcSchema,
  activeSeconds: z.number().finite().nonnegative(),
  idleSeconds: z.number().finite().nonnegative(),
  lockedSeconds: z.number().finite().nonnegative(),
  disconnectedSeconds: z.number().finite().nonnegative(),
  unknownSeconds: z.number().finite().nonnegative(),
  idleThresholdSeconds: z.literal(300)
}).strict();
const envelopeSchema = z.object({
  schemaVersion: z.literal(1),
  deviceId: uuidSchema,
  userSid: z.string().regex(/^S-\d-(?:\d+-)*\d+$/i).max(184),
  userName: z.string().min(1).max(256),
  receivedAtUtc: utcSchema,
  activity: activitySchema
}).strict();

function invalid(res, parsed) {
  return res.status(422).json({
    message: 'El cuerpo no cumple el contrato del agente.',
    code: 'VALIDATION_ERROR',
    errors: parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message }))
  });
}

function requireJson(req, res) {
  if (!req.is('application/json')) {
    res.status(415).json({ message: 'Se requiere Content-Type: application/json.', code: 'UNSUPPORTED_MEDIA_TYPE' });
    return false;
  }
  return true;
}

async function authenticate(req, res, next, enrollmentStore) {
  const token = bearerToken(req);
  const deviceId = getAgentDeviceId(token) || (enrollmentStore ? await enrollmentStore.authenticate(token) : null);
  if (!deviceId) return res.status(401).json({ message: 'Token de agente ausente o inválido.', code: 'UNAUTHORIZED' });
  req.agentDeviceId = deviceId;
  return next();
}

function matchesDevice(req, res, body) {
  if (body.deviceId !== req.agentDeviceId) {
    res.status(403).json({ message: 'El token no está autorizado para este equipo.', code: 'DEVICE_FORBIDDEN' });
    return false;
  }
  return true;
}

function activityIsValid(activity) {
  const started = Date.parse(activity.startedAtUtc);
  const ended = Date.parse(activity.endedAtUtc);
  const duration = ended - started;
  const total = activity.activeSeconds + activity.idleSeconds + activity.lockedSeconds
    + activity.disconnectedSeconds + activity.unknownSeconds;
  return Number.isFinite(duration) && duration >= 0 && duration <= 7 * 24 * 60 * 60 * 1000
    && Math.abs(total - duration / 1000) < 1
    && ended <= Date.now() + 5 * 60 * 1000;
}

export function createAgentRouter(agentDataStore, enrollmentStore = null) {
  const router = Router();
  router.use((req, res, next) => authenticate(req, res, next, enrollmentStore));

  router.post('/inventory', async (req, res) => {
    if (!requireJson(req, res)) return;
    const parsed = inventorySchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    if (!matchesDevice(req, res, parsed.data)) return;
    const receivedAtUtc = new Date().toISOString();
    await agentDataStore.acceptInventory(req.agentDeviceId, parsed.data, receivedAtUtc);
    return res.json({ accepted: true, inventoryId: parsed.data.inventoryId });
  });

  router.post('/heartbeat', async (req, res) => {
    if (!requireJson(req, res)) return;
    const parsed = heartbeatSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    if (!matchesDevice(req, res, parsed.data)) return;
    await agentDataStore.acceptHeartbeat(req.agentDeviceId, parsed.data, new Date().toISOString());
    return res.json({ accepted: true });
  });

  router.post('/activity', async (req, res) => {
    if (!requireJson(req, res)) return;
    if ((req.rawBodyBytes ?? 0) > 16 * 1024) {
      return res.status(413).json({ message: 'El cuerpo supera 16 KiB.', code: 'PAYLOAD_TOO_LARGE' });
    }
    const parsed = envelopeSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    if (!matchesDevice(req, res, parsed.data)) return;
    if (!activityIsValid(parsed.data.activity)) {
      return res.status(422).json({ message: 'El intervalo o la suma de actividad no son válidos.', code: 'VALIDATION_ERROR' });
    }
    const receipt = await agentDataStore.acceptActivity(req.agentDeviceId, parsed.data, new Date().toISOString());
    return res.status(200).json({ batchId: receipt.batchId });
  });

  return router;
}