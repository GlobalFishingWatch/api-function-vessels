const datasets = require('../service/dataset.service');
const log = require('../log');
const {
  errors: { NotFoundException },
} = require('auth-middleware');

module.exports = async (ctx, next) => {
  const datasetId = ctx.params.dataset;
  log.debug(`Loading dataset ${datasetId}`);
  if (ctx.params.dataset.indexOf(':') === -1) {
    ctx.params.dataset += ':latest';
  }
  const dataset = await datasets.get(ctx, datasetId);
  if (!dataset) {
    log.debug(`Unable to load dataset ${datasetId}`);
    throw new NotFoundException(`Unable to load dataset ${datasetId}`);
  }

  ctx.state.dataset = dataset;
  await next();
};
