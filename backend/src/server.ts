import http from 'http';
import { env } from './config/env';
import { createApp } from './app';
import { initWebSocket } from './websocket';
import { prisma } from './config/prisma';

const app = createApp();
const server = http.createServer(app);
initWebSocket(server);

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API + WebSocket: http://localhost:${env.port} (env: ${env.nodeEnv})`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, server };
