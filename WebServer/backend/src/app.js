import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isValidApiToken } from './config.js';
import { createAuthRouter, requirePermission, requireSession } from './routes/auth.js';
import { createFrontendUserRouter, createUserRouter } from './routes/users.js';
import { createEnrollmentRouter } from './routes/enrollment.js';
import { createAgentRouter } from './routes/agents.js';
import { createAgentAssetRouter } from './routes/assets.js';
import { AgentDataStore } from './services/agentDataStore.js';
import { AgentAssetService } from './services/agentAssetService.js';
import { AuthService } from './services/authService.js';
import { SessionStore } from './services/sessionStore.js';
import { UserService } from './services/userService.js';

const frontendPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend');

export function createApp({
  userService = new UserService(),
  authService = new AuthService(),
  sessionStore = new SessionStore({ ttlMs: config.AUTH_SESSION_TTL_MS }),
  agentDataStore = new AgentDataStore(),
  agentAssetService = new AgentAssetService(agentDataStore),
  enrollmentStore = null,
  enrollmentPublicUrl = null
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({
    limit: '32kb',
    verify(req, _res, buffer) { req.rawBodyBytes = buffer.length; }
  }));

  // Permite solicitudes del origen configurado y responde los preflight del navegador.
  app.use((req, res, next) => {
    const origin = config.CORS_ORIGIN;
    if (origin === '*' || req.headers.origin === origin) {
      res.setHeader('Access-Control-Allow-Origin', origin === '*' ? '*' : origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  // Limita el volumen de solicitudes para reducir abuso en login y operaciones de API.
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api/v1/auth/login', rateLimit({
    windowMs: 15 * 60_000, limit: 10, skipSuccessfulRequests: true,
    standardHeaders: 'draft-7', legacyHeaders: false
  }));
  app.use('/api/v1/auth', createAuthRouter({ authService, sessionStore }));
  app.use('/api/v1', requireSession(sessionStore));
  app.use('/api/v1/users', (req, res, next) => {
    if (req.method === 'GET' && req.path.endsWith('/backups')) return requirePermission('users.view')(req, res, next);
    if (req.method === 'GET') return requirePermission('users.view', 'assets.assign')(req, res, next);
    return requirePermission('users.write')(req, res, next);
  }, createFrontendUserRouter(userService));
  app.use('/api/v1/assets', requirePermission('assets.view'), createAgentAssetRouter(agentAssetService, enrollmentStore));

  // Legacy endpoints retain the shared API-token contract.
  app.use('/api/users', (req, res, next) => {
    const authorization = req.get('authorization') ?? '';
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !isValidApiToken(token)) {
      return res.status(401).json({ message: 'Token de API ausente o inválido.', error: 'Token de API ausente o inválido', code: 'UNAUTHORIZED' });
    }
    return next();
  });
  app.use('/api/agents/enroll', createEnrollmentRouter(enrollmentStore, enrollmentPublicUrl));
  app.use('/api/agents', createAgentRouter(agentDataStore, enrollmentStore));

  // Health queda público para que los sistemas de supervisión comprueben el proceso.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/users', createUserRouter(userService));
  app.use(express.static(frontendPath));
  app.use((_req, res) => res.status(404).json({ message: 'La ruta solicitada no existe.', error: 'Ruta no encontrada', code: 'NOT_FOUND' }));

  // Oculta detalles internos al cliente y registra solo el mensaje del error en el servidor.
  app.use((error, _req, res, _next) => {
    const status = error.status ?? (error.code === 'LDAPS_REQUIRED' ? 400 : 500);
    if (status >= 500) console.error('Error de API:', error.message);
    const message = status >= 500 ? 'Error interno del servidor.' : error.message;
    return res.status(status).json({
      message,
      error: message,
      code: error.code ?? 'ERROR',
      ...(error.errors ? { errors: error.errors } : {})
    });
  });
  return app;
}