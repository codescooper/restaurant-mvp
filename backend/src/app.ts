import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { sanitizeBody } from './middlewares/sanitizeMiddleware';

export function createApp() {
  const app = express();

  // Derrière le proxy Railway (1 hop) : faire confiance au 1er X-Forwarded-For
  // pour que req.ip soit l'IP réelle du client (sinon les rate limiters voient
  // tous l'IP du proxy, et express-rate-limit v7 lève une erreur de validation).
  app.set('trust proxy', 1);

  // En dev (HTTP sur localhost), on désactive HSTS et la CSP : leurs directives
  // (Strict-Transport-Security, upgrade-insecure-requests) forcent le navigateur à passer en
  // HTTPS sur localhost, ce qui casse les appels API et les téléchargements de fichiers vers :3000.
  app.use(
    helmet({
      hsts: env.isProd ? undefined : false,
      contentSecurityPolicy: env.isProd ? undefined : false,
    })
  );
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '4mb' }));
  app.use(sanitizeBody);

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
