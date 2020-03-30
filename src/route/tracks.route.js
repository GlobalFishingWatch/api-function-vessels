const Router = require('koa-router');
const { koa } = require('auth-middleware');
const loadDatasetMiddleware = require('../middleware/load-dataset.middleware');
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
    const { features } = ctx.query;
    const { binary } = ctx.query;

    log.debug(
      `Configuring track loader for dataset ${ctx.state.dataset} using additional features ${features}`,
    );
    const trackLoader = trackService({
      dataset: ctx.state.dataset,
      additionalFeatures: features,
      params,
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

    await encodeService(ctx, 'geojson', binary)(result);
  }
}

const router = new Router({
  prefix: '/datasets',
});
router.use(koa.obtainUser(false));

router.get(
  '/:dataset/vessels/:vesselId/tracks',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueParam: 'dataset' },
  ]),
  redis([]),
  tracksValidation,
  loadDatasetMiddleware,
  TracksRouter.getTracks,
);

module.exports = router;
