const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('./middleware/cors.middleware');
const logMiddleware = require('./middleware/log.middleware');
const errors = require('./middleware/errors.middleware');
const { redis } = require('./middleware/caching.middleware');
const routes = require('./route');

const app = express();

app.use(logMiddleware.logger());
app.use(helmet());
app.use(cors.simple());
app.use(redis(['/cache/flush*']));
app.use(compression());
routes.forEach(registerRoute => registerRoute(app));
app.use(logMiddleware.errorLogger());
app.use(errors.handleErrors());

exports.entrypoint = app;
