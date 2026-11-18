import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';

export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const normalizeCode = (value) => value.replace(/[\s-]/g, '').toUpperCase();
const newCode = () => randomBytes(16).toString('hex').toUpperCase();
const formatCode = (value) => value.match(/.{1,4}/g).join('-');
const tokenFor = (secret, salt) => createHmac('sha256', Buffer.from(secret, 'hex')).update(Buffer.from(salt, 'hex')).digest('hex');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

export class EnrollmentStore {
  constructor(pool) { this.pool = pool; }
  async create(name, actor) {
    const code = newCode();
    const { rows } = await this.pool.query(`INSERT INTO gestio_enrollment_devices
      (id,name,created_by,code_hash,expires_at) VALUES ($1,$2,$3,$4,clock_timestamp()+interval '24 hours')
      RETURNING id,name,expires_at`, [randomUUID(), name, actor, hash(code)]);
    return { ...rows[0], enrollmentCode: formatCode(code) };
  }
  async renew(id) {
    const code = newCode();
    const { rows } = await this.pool.query(`UPDATE gestio_enrollment_devices SET code_hash=$2,
      expires_at=clock_timestamp()+interval '24 hours' WHERE id=$1 AND enrolled_at IS NULL AND revoked_at IS NULL
      RETURNING id,name,expires_at`, [id, hash(code)]);
    if (!rows.length) throw fail(409, 'NOT_PENDING', 'Solo se puede renovar un equipo pendiente y no anulado.');
    return { ...rows[0], enrollmentCode: formatCode(code) };
  }
  async revoke(id) {
    const { rowCount } = await this.pool.query('UPDATE gestio_enrollment_devices SET revoked_at=clock_timestamp() WHERE id=$1', [id]);
    if (!rowCount) throw fail(404, 'NOT_FOUND', 'Equipo no encontrado.');
  }
  async list() {
    const { rows } = await this.pool.query(`SELECT id,name,device_id,computer_name,enrolled_at,revoked_at,
      (expires_at<=clock_timestamp()) AS expired FROM gestio_enrollment_devices ORDER BY created_at DESC`);
    return rows;
  }
  async authenticate(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    const { rows } = await this.pool.query(`SELECT device_id FROM gestio_enrollment_devices
      WHERE token_hash=$1 AND enrolled_at IS NOT NULL AND revoked_at IS NULL`, [hash(token)]);
    return rows[0]?.device_id ?? null;
  }
  async redeem({ code, deviceId, computerName, requestId, recoverySecret }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`SELECT *, clock_timestamp() AS server_now
        FROM gestio_enrollment_devices WHERE code_hash=$1 FOR UPDATE`, [hash(normalizeCode(code))]);
      const row = rows[0];
      if (!row || row.revoked_at) throw fail(403, 'CODE_INVALID', 'Código inválido o anulado.');
      const recoveryHash = hash(recoverySecret);
      if (row.enrolled_at) {
        // A replay needs BOTH the original secret and the installation identity, not only the code.
        if (row.device_id !== deviceId || row.request_id !== requestId || row.recovery_hash !== recoveryHash)
          throw fail(409, 'CODE_USED', 'Este código ya fue utilizado por otra instalación.');
        if (new Date(row.server_now) - new Date(row.enrolled_at) > 24 * 3600_000)
          throw fail(409, 'RECOVERY_EXPIRED', 'La recuperación venció. Contacte al administrador.');
      } else {
        if (new Date(row.expires_at) <= new Date(row.server_now)) throw fail(410, 'CODE_EXPIRED', 'El código venció. Genere otro desde la web.');
        row.response_salt = randomBytes(32).toString('hex');
        const token = tokenFor(recoverySecret, row.response_salt);
        await client.query(`UPDATE gestio_enrollment_devices SET device_id=$2, computer_name=$3,
          enrolled_at=clock_timestamp(), token_hash=$4, request_id=$5, recovery_hash=$6, response_salt=$7 WHERE id=$1`,
        [row.id, deviceId, computerName, hash(token), requestId, recoveryHash, row.response_salt]);
      }
      await client.query('COMMIT');
      return { deviceId, assetId: row.id, token: tokenFor(recoverySecret, row.response_salt) };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') throw fail(409, 'DEVICE_EXISTS', 'Este dispositivo ya está vinculado. Conserve su configuración existente.');
      throw error;
    } finally { client.release(); }
  }
}
