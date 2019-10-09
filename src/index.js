const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('./middleware/cors');
const logMiddleware = require('./middleware/log');
const errors = require('./middleware/errors');
const { redis } = require('./middleware/caching');
const routes = require('./routes');

const app = express();

app.use(logMiddleware.logger());
app.use(helmet());
app.use(cors.simple());
app.use(redis());
app.use(compression());
routes.forEach(registerRoute => registerRoute(app));
app.use(logMiddleware.errorLogger());
app.use(errors.handleErrors());

exports.entrypoint = app;
