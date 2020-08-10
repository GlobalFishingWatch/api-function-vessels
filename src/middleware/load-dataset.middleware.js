const datasets = require('../service/dataset.service');
const log = require('../log');
const {
  errors: { NotFoundException },
} = require('auth-middleware');

module.exports = (version = 'v0') => async (ctx, next) => {
  if (ctx.params.dataset.indexOf(':') === -1) {
    ctx.params.dataset += ':latest';
  }
  const datasetId = ctx.params.dataset;
  log.debug(`Loading dataset ${datasetId}`);
  const dataset = await datasets.get(ctx, datasetId, version);
  if (!dataset) {
    log.debug(`Unable to load dataset ${datasetId}`);
    throw new NotFoundException(`Unable to load dataset ${datasetId}`);
  }
  ctx.state.datasetVersion = version;
  ctx.state.dataset = dataset;
  await next();
};
