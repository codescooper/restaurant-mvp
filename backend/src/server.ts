import http from 'http';
import { env } from './config/env';
import { createApp } from './app';
import { initWebSocket } from './websocket';
import { prisma, connectWithRetry } from './config/prisma';

const app = createApp();
const server = http.createServer(app);
initWebSocket(server);

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API + WebSocket: http://localhost:${env.port} (env: ${env.nodeEnv})`);
});

// Réveille la base (Neon free tier se met en veille) sans bloquer le démarrage du serveur.
connectWithRetry().then((ok) => {
  // eslint-disable-next-line no-console
  console.log(ok ? 'DB connectée.' : 'DB indisponible — reconnexion automatique à la 1re requête.');
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, server };
