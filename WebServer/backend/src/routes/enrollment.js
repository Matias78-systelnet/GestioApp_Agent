import { config } from '../config.js';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { normalizeCode } from '../services/enrollmentStore.js';
const uuid = z.string().uuid().transform(v => v.toLowerCase());
const schema = z.object({
  code: z.string().max(100).transform(normalizeCode).pipe(z.string().regex(/^[A-F0-9]{32}$/)),
  deviceId: uuid, requestId: uuid, computerName: z.string().trim().min(1).max(256),
  recoverySecret: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export function createEnrollmentRouter(store, publicUrl) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/', rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }), async (req, res) => {
    if (!store || !publicUrl) return res.status(503).json({ message: 'Vinculación no configurada en el servidor.' });
    if (!req.is('application/json')) return res.status(415).json({ message: 'Se requiere JSON.' });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: 'Solicitud de vinculación inválida.' });
    if (Object.hasOwn(config.agentDeviceTokens, parsed.data.deviceId))
      return res.status(409).json({ message: 'Dispositivo configurado por el mecanismo anterior. Conserve su credencial.' });
    const receipt = await store.redeem(parsed.data);
    return res.json({ ...receipt, apiEnabled: true, inventorySeconds: 300, heartbeatSeconds: 60,
      inventoryEndpoint: `${publicUrl}/api/agents/inventory`, heartbeatEndpoint: `${publicUrl}/api/agents/heartbeat` });
  });
  return router;
}
