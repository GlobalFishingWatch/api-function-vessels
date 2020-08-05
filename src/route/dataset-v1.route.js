const Router = require('koa-router');
const {
  koa,
  errors: { NotFoundException },
} = require('auth-middleware');
const checkDatasetTypeMiddleware = require('../middleware/check-type-dataset.middleware');
const vesselService = require('../service/vessel.service');
const loadDatasetMiddleware = require('../middleware/load-dataset.middleware');
const log = require('../log');
const {
  datasetValidation,
  datasetOfVesselIdValidation,
} = require('../validation/dataset.validation');
const encodeService = require('../service/encode.service');
const { redis } = require('../middleware/caching.middleware');

class DatasetRouter {
  static async getAllVessels(ctx) {
    const query = {
      limit: ctx.query.limit,
      offset: ctx.query.offset,
      query: ctx.query.query,
      queryFields: ctx.query.queryFields,
      querySuggestions: ctx.query.querySuggestions,
    };
    log.debug('Querying vessels search index');
    const results = await vesselService({
      dataset: ctx.state.dataset,
      version: ctx.state.datasetVersion,
    }).search(query);

    log.debug(`Returning ${results.entries.length} / ${results.total} results`);
    ctx.state.cacheTags = [`dataset`, `dataset-${ctx.params.dataset}`];

    await encodeService(ctx, 'DatasetVesselQuery', ctx.query.binary)(results);
  }

  static async getVesselById(ctx) {
    try {
      const { vesselId } = ctx.params;
      log.debug(`Looking up vessel information for vessel ${vesselId}`);
      const result = await vesselService({
        dataset: ctx.state.dataset,
        version: ctx.state.datasetVersion,
      }).get(vesselId);

      log.debug('Returning vessel information');
      ctx.state.cacheTags = [
        `dataset`,
        'vessel',
        `dataset-${ctx.params.dataset}`,
        `vessel-${vesselId}`,
      ];
      await encodeService(ctx, 'DatasetVesselInfo', ctx.query.binary)(result);
    } catch (error) {
      if (error.statusCode && error.statusCode === 404) {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}

const router = new Router({
  prefix: '/v1/datasets',
});
router.use(koa.obtainUser(false));

router.get(
  '/:dataset/vessels',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueParam: 'dataset' },
  ]),
  redis([]),
  datasetValidation,
  loadDatasetMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-vessels'),
  DatasetRouter.getAllVessels,
);

router.get(
  '/:dataset/vessels/:vesselId',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueParam: 'dataset' },
  ]),
  redis([]),
  datasetOfVesselIdValidation,
  loadDatasetMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-vessels'),
  DatasetRouter.getVesselById,
);

module.exports = router;
