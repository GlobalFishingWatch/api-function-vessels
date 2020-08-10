const Router = require('koa-router');
const { koa } = require('auth-middleware');
const loadDatasetMiddleware = require('../middleware/load-dataset.middleware');
const checkDatasetTypeMiddleware = require('../middleware/check-type-dataset.middleware');
const trackService = require('../service/tracks.service');
const log = require('../log');
const { tracksValidation } = require('../validation/track.validation');
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

    log.debug(
      `Configuring track loader for dataset ${ctx.state.dataset} using additional fields ${fields}`,
    );
    const trackLoader = trackService({
      dataset: ctx.state.dataset,
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
      `tracks-${ctx.params.dataset}`,
      'vessel',
      `vessel-${vesselId}`,
    ];

    for (let i = startYear; i <= endYear; i++) {
      ctx.state.cacheTags.push(`tracks-${ctx.params.dataset}-${i}`);
      ctx.state.cacheTags.push(`tracks-year-${i}`);
    }
    log.debug(`Returning track for vessel ${vesselId}`);

    await encodeService(ctx, ctx.query.format, binary)(result);
  }
}

const router = new Router({
  prefix: '/v1/datasets',
});
router.use(koa.obtainUser(false));

router.get(
  '/:dataset/vessels/:vesselId/tracks',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueParam: 'dataset' },
  ]),
  redis([]),
  tracksValidation,
  loadDatasetMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-tracks'),
  TracksRouter.getTracks,
);

module.exports = router;
