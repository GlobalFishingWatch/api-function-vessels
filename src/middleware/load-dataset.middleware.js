const datasets = require('../service/dataset.service');
const log = require('../log');
const { NotFoundException } = require('../errors/http.error');

module.exports = async (ctx, next) => {
  const datasetId = ctx.params.dataset;

  log.debug(`Loading dataset ${datasetId}`);
  const dataset = await datasets.get(datasetId);
  if (!dataset) {
    log.debug(`Unable to load dataset ${datasetId}`);
    throw new NotFoundException(`Unable to load dataset ${datasetId}`);
  }
  ctx.state.dataset = dataset;
  await next();
};
