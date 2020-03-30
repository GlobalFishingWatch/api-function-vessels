const Koa = require('koa');
const Body = require('koa-body');
const Logger = require('koa-logger');
const Cors = require('@koa/cors');
const { koa } = require('auth-middleware');

const HelmetMiddleware = require('./middleware/helmet.middleware');
const logMiddleware = require('./middleware/log.middleware');
const errors = require('./middleware/errors.middleware');
const { redis } = require('./middleware/caching.middleware');

const cacheRouter = require('./route/cache.route');
const datasetRouter = require('./route/dataset.route');
const tilesetRouter = require('./route/tileset.route');
const tracksRouter = require('./route/tracks.route');

const app = new Koa();
if (process.env.NODE_ENV === 'development') {
  app.use(Logger());
}

app.use(Cors());
app.use(Body());
app.use(HelmetMiddleware());
app.use(errors.handleErrors);
app.use(logMiddleware.logger());
app.use(koa.health());

app.use(cacheRouter.routes()).use(cacheRouter.allowedMethods());
app.use(datasetRouter.routes()).use(datasetRouter.allowedMethods());
app.use(tilesetRouter.routes()).use(tilesetRouter.allowedMethods());
app.use(tracksRouter.routes()).use(tracksRouter.allowedMethods());

exports.entrypoint = app.callback();
