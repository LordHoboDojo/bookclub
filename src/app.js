import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import config from './config/index.js';
import passport from './config/passport.js';
import { csrf } from './middleware/csrf.js';
import { flash } from './middleware/flash.js';
import { errorHandler, notFound } from './middleware/errors.js';
import routes from './routes/index.js';
import * as viewHelpers from './views/helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // ---- View layer (EJS) ----
  app.set('views', path.join(here, 'views'));
  app.set('view engine', 'ejs');
  app.locals.appName = config.appName;
  app.locals.h = viewHelpers;

  // Behind ALB / CloudFront in AWS. CloudFront talks to the ALB over HTTP and reports the
  // viewer's scheme in CloudFront-Forwarded-Proto; promote it so secure cookies work.
  app.set('trust proxy', config.isProd ? 2 : false);
  app.use((req, res, next) => {
    const cfProto = req.get('cloudfront-forwarded-proto');
    if (cfProto) req.headers['x-forwarded-proto'] = cfProto;
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'https://covers.openlibrary.org', 'https://*.googleusercontent.com'],
          'upgrade-insecure-requests': config.isProd ? [] : null,
        },
      },
    }),
  );
  app.use(morgan(config.isProd ? 'combined' : 'dev', { skip: (req) => req.path === '/healthz' }));
  app.use(express.static(path.join(here, '..', 'public'), { maxAge: config.isProd ? '7d' : 0 }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use(
    session({
      name: 'bookclub.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: mongoose.connection.getClient(),
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60,
      }),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
        maxAge: 14 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, res, next) => {
    res.locals.currentUser = req.user ?? null;
    res.locals.currentPath = req.path;
    res.locals.club = null;
    res.locals.isLeader = false;
    next();
  });
  app.use(flash);
  app.use(csrf);

  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
