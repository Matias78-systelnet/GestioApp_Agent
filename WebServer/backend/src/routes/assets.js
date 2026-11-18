import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from './auth.js';
const createSchema = z.object({ name: z.string().trim().min(1).max(120) }).strict();
export function createAgentAssetRouter(agentAssetService, enrollmentStore = null) {
  const router = Router();
  router.get('/', async (_req, res) => {
    const result = await agentAssetService.list();
    if (!enrollmentStore) return res.json(result);
    const pending = await enrollmentStore.list();
    const matched = new Set();
    const items = pending.map(row => {
      const snapshot = result.items.find(item => item.id === row.device_id);
      if (snapshot) matched.add(snapshot.id);
      return { ...(snapshot ?? { type: null, serial: null, condition: null, assignedTo: null, location: '' }),
        id: row.id, deviceId: row.device_id, name: row.name, managedEnrollment: true,
        enrollmentStatus: row.revoked_at ? 'revoked' : row.enrolled_at ? 'linked' : 'pending',
        status: row.revoked_at ? 'Acceso revocado' : row.enrolled_at ? (snapshot?.status ?? 'Vinculado · esperando inventario')
          : row.expired ? 'Código vencido' : 'Pendiente de instalación' };
    });
    items.push(...result.items.filter(item => !matched.has(item.id)));
    return res.json({ items, total: items.length });
  });
  router.use(requirePermission('assets.write'));
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!enrollmentStore) return res.status(503).json({ message: 'Configure PostgreSQL para habilitar la vinculación.' });
    next();
  });
  router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: 'Ingrese un nombre de equipo de 1 a 120 caracteres.' });
    return res.status(201).json(await enrollmentStore.create(parsed.data.name, req.authUser.email ?? req.authUser.name ?? 'Administrador'));
  });
  router.use('/:id', (req, res, next) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(422).json({ message: 'Identificador inválido.' });
    next();
  });
  router.post('/:id/enrollment-code', async (req, res) => res.json(await enrollmentStore.renew(req.params.id)));
  router.delete('/:id', async (req, res) => { await enrollmentStore.revoke(req.params.id); res.sendStatus(204); });
  return router;
}
