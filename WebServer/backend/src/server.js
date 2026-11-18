import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createEnrollmentPool } from './services/enrollmentPool.js';
import { EnrollmentStore } from './services/enrollmentStore.js';
import { createApp } from './app.js';
import { config } from './config.js';

// Punto de entrada: activa HTTPS solo cuando se configuran certificado y clave.
const enrollmentPool = createEnrollmentPool();
let publicUrl = null;
if (enrollmentPool) {
  const url = new URL(process.env.ENROLLMENT_PUBLIC_URL || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('ENROLLMENT_PUBLIC_URL debe ser el origen HTTPS público, sin ruta ni credenciales.');
  publicUrl = url.origin;
}
const app = createApp({ enrollmentStore: enrollmentPool ? new EnrollmentStore(enrollmentPool) : null,
  enrollmentPublicUrl: publicUrl });
const createServer = config.httpsOptions ? createHttpsServer : createHttpServer;
const server = createServer(config.httpsOptions ?? {}, app);
server.listen(config.PORT, () => {
  const protocol = config.httpsOptions ? 'https' : 'http';
  console.log(`API disponible en ${protocol}://localhost:${config.PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
// Cierra el servidor de forma ordenada al detener el proceso.
  process.on(signal, () => server.close(async () => { await enrollmentPool?.end(); process.exit(0); }));
}