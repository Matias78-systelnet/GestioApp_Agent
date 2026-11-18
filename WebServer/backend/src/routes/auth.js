import { Router } from 'express';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email().max(256),
  password: z.string().min(1).max(256)
}).strict();

export function bearerToken(req) {
  const authorization = req.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export function requireSession(sessionStore) {
  return (req, res, next) => {
    const token = bearerToken(req);
    const user = sessionStore.get(token);
    if (!user) return res.status(401).json({
      message: 'Su sesión expiró. Inicie sesión nuevamente.', code: 'UNAUTHORIZED'
    });
    req.authToken = token;
    req.authUser = user;
    return next();
  };
}

export function requirePermission(...permissions) {
  const grants = {
    Administrador: ['*'],
    Supervisor: ['dashboard.view', 'assets.view', 'assets.write', 'assets.assign', 'users.view', 'audit.view', 'downloads.view', 'settings.view'],
    Usuario: ['dashboard.view', 'downloads.view', 'settings.view']
  };
  return (req, res, next) => {
    const userGrants = grants[req.authUser?.role] ?? [];
    if (userGrants.includes('*') || permissions.some((permission) => userGrants.includes(permission))) return next();
    return res.status(403).json({ message: 'No tiene permisos para realizar esta acción.', code: 'FORBIDDEN' });
  };
}

export function createAuthRouter({ authService, sessionStore }) {
  const router = Router();
  const authenticated = requireSession(sessionStore);

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        message: 'Ingrese un email válido y su contraseña.',
        code: 'VALIDATION_ERROR',
        errors: Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message]))
      });
    }
    const user = await authService.login(parsed.data.email, parsed.data.password);
    const token = sessionStore.create(user);
    return res.json({ token, user });
  });

  router.post('/logout', authenticated, (req, res) => {
    sessionStore.revoke(req.authToken);
    return res.status(204).end();
  });

  router.get('/me', authenticated, (req, res) => res.json(req.authUser));
  return router;
}