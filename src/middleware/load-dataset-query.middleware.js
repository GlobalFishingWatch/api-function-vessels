const datasets = require('../service/dataset.service');
const log = require('../log');
const {
  errors: { NotFoundException, BadRequestException },
} = require('auth-middleware');

module.exports = (version = 'v0') => async (ctx, next) => {
  if (!ctx.query.datasets) {
    throw new BadRequestException('Query param datasets is required');
  }
  log.debug(`Loading datasets`);
  ctx.state.datasets = await Promise.all(
    ctx.query.datasets.map(async datasetId => {
      const dataset = await datasets.get(ctx, datasetId, version);
      if (!dataset) {
        log.debug(`Unable to load dataset ${datasetId}`);
        throw new NotFoundException(`Unable to load dataset ${datasetId}`);
      }
      return dataset;
    }),
  );

  ctx.state.datasetVersion = version;

  await next();
};
