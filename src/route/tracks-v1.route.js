const Router = require('koa-router');
const { koa } = require('auth-middleware');
const loadDatasetQueryMiddleware = require('../middleware/load-dataset-query.middleware');
const checkDatasetTypeMiddleware = require('../middleware/check-type-dataset.middleware');
const trackService = require('../service/tracks.service');
const log = require('../log');
const { tracksV1Validation } = require('../validation/track.validation');
const encodeService = require('../service/encode.service');
const { redis } = require('../middleware/caching.middleware');

class TracksRouter {
  static async getTracks(ctx) {
    const { vesselId } = ctx.params;
    const params = {
      startDate: ctx.query.startDate,
      endDate: ctx.query.endDate,
      wrapLongitudes: ctx.query.wrapLongitudes,
    };

    const { format } = ctx.query;
    const { fields } = ctx.query;
    const { binary } = ctx.query;
    const dataset = ctx.state.datasets[0];
    log.debug(
      `Configuring track loader for dataset ${dataset} using additional fields ${fields}`,
    );
    const trackLoader = trackService({
      dataset,
      additionalFeatures: fields.filter(f => f !== 'lonlat'),
      params,
      fields,
      version: ctx.state.datasetVersion,
    });

    log.debug(`Looking up track for vessel ${vesselId}`);

    const records = await trackLoader.load(vesselId);

    log.debug(`Converting the records to format ${format}`);
    const result = trackLoader.formatters[format](records);
    log.debug('Setting year tags');

    const startYear = new Date(params.startDate).getFullYear();
    const endYear = new Date(params.endDate).getFullYear();
    ctx.state.cacheTags = [
      'tracks',
      `tracks-${dataset.id}`,
      'vessel',
      `vessel-${vesselId}`,
    ];

    for (let i = startYear; i <= endYear; i++) {
      ctx.state.cacheTags.push(`tracks-${dataset.id}-${i}`);
      ctx.state.cacheTags.push(`tracks-year-${i}`);
    }
    log.debug(`Returning track for vessel ${vesselId}`);

    await encodeService(ctx, ctx.query.format, binary)(result);
  }
}

const router = new Router({
  prefix: '/v1',
});
router.use(koa.obtainUser(false));

router.get(
  '/vessels/:vesselId/tracks',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueQueryParam: 'datasets' },
  ]),
  redis([]),
  tracksV1Validation,
  loadDatasetQueryMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-tracks'),
  TracksRouter.getTracks,
);

module.exports = router;