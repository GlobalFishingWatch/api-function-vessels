const Koa = require('koa');
const Body = require('koa-body');
const Logger = require('koa-logger');
const Cors = require('@koa/cors');
const { koa } = require('auth-middleware');
const config = require('./config');
const { log } = require('gfw-api-utils').logger;
const { koaTransactionIdMiddleware } = require('gfw-api-utils').transactionId;
const HelmetMiddleware = require('./middleware/helmet.middleware');
const logMiddleware = require('./middleware/log.middleware');
const errors = require('./middleware/errors.middleware');

const cacheRouter = require('./route/cache.route');
const datasetRouter = require('./route/dataset.route');
const datasetV1Router = require('./route/vessel-v1.route');
const tilesetRouter = require('./route/tileset.route');
const tracksRouter = require('./route/tracks.route');
const tracksV1Router = require('./route/tracks-v1.route');

const app = new Koa();
if (process.env.NODE_ENV === 'development') {
  app.use(Logger());
}

app.use(Cors());
app.use(Body());
app.use(HelmetMiddleware());
app.use(koaTransactionIdMiddleware());
app.use(errors.handleErrors);
app.use(logMiddleware.logger());
app.use(koa.health());

app.use(cacheRouter.routes()).use(cacheRouter.allowedMethods());
app.use(datasetRouter.routes()).use(datasetRouter.allowedMethods());
app.use(tilesetRouter.routes()).use(tilesetRouter.allowedMethods());
app.use(tracksRouter.routes()).use(tracksRouter.allowedMethods());
app.use(tracksV1Router.routes()).use(tracksV1Router.allowedMethods());
app.use(datasetV1Router.routes()).use(datasetV1Router.allowedMethods());

app.listen(config.server.port);
log.debug(`Server up and listening on port ${config.server.port}`);
