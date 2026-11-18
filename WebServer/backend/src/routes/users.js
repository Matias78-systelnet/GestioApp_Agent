import { Router } from 'express';
import { z } from 'zod';
import { hasPasswordComplexity, PASSWORD_COMPLEXITY_MESSAGE } from '../services/passwordPolicy.js';

// Acepta nombres de cuenta simples y acota los datos recibidos desde HTTP.
const usernameSchema = z.string().min(1).max(20).regex(/^[A-Za-z0-9._-]+$/);
const passwordSchema = z.string().min(8).max(128).refine(hasPasswordComplexity, PASSWORD_COMPLEXITY_MESSAGE);
const userFields = {
  username: usernameSchema,
  userPrincipalName: z.string().email().max(256),
  password: passwordSchema,
  givenName: z.string().min(1).max(64),
  surname: z.string().min(1).max(64),
  displayName: z.string().min(1).max(256),
  email: z.string().email().max(256).optional(),
  department: z.string().max(64).optional(),
  title: z.string().max(64).optional(),
  enabled: z.boolean().default(true)
};
// El alta exige los atributos base; PATCH solo permite cambiar campos explícitos.
const createSchema = z.object(userFields).strict();
const updateSchema = z.object({
  password: passwordSchema.optional(),
  givenName: userFields.givenName.optional(),
  surname: userFields.surname.optional(),
  displayName: userFields.displayName.optional(),
  email: userFields.email,
  department: userFields.department,
  title: userFields.title,
  enabled: z.boolean().optional()
}).strict().refine((value) => Object.keys(value).length > 0, 'Debe enviar al menos un campo');
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0)
});
const frontendUserSchema = z.object({
  name: z.string().trim().min(1).max(256),
  rut: z.string().trim().min(2).max(16),
  email: z.string().trim().email().max(256),
  password: passwordSchema.optional(),
  role: z.enum(['Usuario', 'Supervisor', 'Administrador']),
  area: z.enum(['RRHH', 'Contabilidad', 'Operaciones', 'Informática', 'Soporte TI', 'Gerencia'])
}).strict();
const frontendIdSchema = z.string().regex(/^[a-fA-F0-9]{32}$/);

function normalizeRut(value) {
  const clean = value.replace(/[.-]/g, '').trim().toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(clean)) return null;
  const body = clean.slice(0, -1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const check = 11 - (sum % 11);
  const expected = check === 11 ? '0' : check === 10 ? 'K' : String(check);
  if (clean.at(-1) !== expected) return null;
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${expected}`;
}

function parseFrontendUser(body, creating) {
  const parsed = frontendUserSchema.safeParse(body);
  if (!parsed.success) {
    return { error: { message: 'Revise los datos ingresados.', code: 'VALIDATION_ERROR', errors: Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])) } };
  }
  const rut = normalizeRut(parsed.data.rut);
  if (!rut) return { error: { message: 'Revise los datos ingresados.', code: 'VALIDATION_ERROR', errors: { rut: 'Ingrese un RUT válido.' } } };
  if (creating && !parsed.data.password) {
    return { error: { message: 'Revise los datos ingresados.', code: 'VALIDATION_ERROR', errors: { password: 'Ingrese una contraseña.' } } };
  }
  return { data: { ...parsed.data, rut } };
}

export function createFrontendUserRouter(userService) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const items = await userService.listFrontend();
    return res.json({ items, total: items.length });
  });

  router.post('/', async (req, res) => {
    const parsed = parseFrontendUser(req.body, true);
    if (parsed.error) return res.status(422).json(parsed.error);
    const user = await userService.createFrontend(parsed.data);
    return res.status(201).json(user);
  });

  router.get('/:id/backups', (req, res) => {
    return res.status(501).json({
      message: 'La consulta de respaldos no está configurada en este servidor.',
      code: 'BACKUPS_UNAVAILABLE'
    });
  });

  router.get('/:id', async (req, res) => {
    const id = frontendIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: 'Identificador de usuario inválido.', code: 'VALIDATION_ERROR' });
    const user = await userService.getById(id.data);
    if (!user) return res.status(404).json({ message: 'El usuario ya no existe. Recargue la lista.', code: 'NOT_FOUND' });
    return res.json(user);
  });

  router.put('/:id', async (req, res) => {
    const id = frontendIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: 'Identificador de usuario inválido.', code: 'VALIDATION_ERROR' });
    const parsed = parseFrontendUser(req.body, false);
    if (parsed.error) return res.status(422).json(parsed.error);
    const user = await userService.updateFrontend(id.data, parsed.data);
    if (!user) return res.status(404).json({ message: 'El usuario ya no existe. Recargue la lista.', code: 'NOT_FOUND' });
    return res.json(user);
  });

  router.patch('/:id/status', async (req, res) => {
    const id = frontendIdSchema.safeParse(req.params.id);
    const status = z.object({ status: z.enum(['active', 'disabled']) }).strict().safeParse(req.body);
    if (!id.success) return res.status(400).json({ message: 'Identificador de usuario inválido.', code: 'VALIDATION_ERROR' });
    if (!status.success) return res.status(422).json({ message: 'Estado no válido.', code: 'VALIDATION_ERROR' });
    const user = await userService.setStatusById(id.data, status.data.status);
    if (!user) return res.status(404).json({ message: 'El usuario ya no existe. Recargue la lista.', code: 'NOT_FOUND' });
    return res.json(user);
  });

  router.delete('/:id', async (req, res) => {
    const id = frontendIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: 'Identificador de usuario inválido.', code: 'VALIDATION_ERROR' });
    const removed = await userService.removeById(id.data);
    if (!removed) 
      return res.status(404).json({ message: 'El usuario ya no existe. Recargue la lista.', code: 'NOT_FOUND' });
    return res.status(204).end();
  });

  return router;
}

export function createUserRouter(userService) {
  const router = Router();

  // GET /: limita la consulta al tramo solicitado y reporta si hay más resultados.
  router.get('/', async (req, res) => {
    const query = paginationSchema.safeParse(req.query);
    if (!query.success) return res.status(400).json({ error: 'Parametros de paginacion invalidos' });
    const result = await userService.list(query.data);
    return res.json({ data: result.users, pagination: { ...query.data, hasMore: result.hasMore } });
  });

  // POST /: valida el alta antes de delegar las reglas de negocio al servicio.
  router.post('/', async (req, res) => {
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Datos de usuario invalidos', details: body.error.issues });
    const user = await userService.create(body.data);
    return res.status(201).json({ data: user });
  });

  // GET /:username: busca por sAMAccountName y distingue un usuario inexistente.
  router.get('/:username', async (req, res) => {
    const username = usernameSchema.safeParse(req.params.username);
    if (!username.success) return res.status(400).json({ error: 'Nombre de usuario invalido' });
    const user = await userService.get(username.data);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({ data: user });
  });

  // PATCH /:username: modifica solo los atributos incluidos en la solicitud.
  router.patch('/:username', async (req, res) => {
    const username = usernameSchema.safeParse(req.params.username);
    const body = updateSchema.safeParse(req.body);
    if (!username.success) return res.status(400).json({ error: 'Nombre de usuario invalido' });
    if (!body.success) return res.status(400).json({ error: 'Datos de usuario invalidos', details: body.error.issues });
    const user = await userService.update(username.data, body.data);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({ data: user });
  });

  // DELETE /:username: responde sin cuerpo cuando el borrado se completa.
  router.delete('/:username', async (req, res) => {
    const username = usernameSchema.safeParse(req.params.username);
    if (!username.success) return res.status(400).json({ error: 'Nombre de usuario invalido' });
    const removed = await userService.remove(username.data);
    if (!removed) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.status(204).end();
  });

  return router;
}