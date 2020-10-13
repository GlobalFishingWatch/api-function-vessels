const Router = require('koa-router');
const {
  koa,
  errors: { NotFoundException },
} = require('auth-middleware');
const checkDatasetTypeMiddleware = require('../middleware/check-type-dataset.middleware');
const vesselService = require('../service/vessel.service');
const loadDatasetQueryMiddleware = require('../middleware/load-dataset-query.middleware');
const log = require('../log');
const {
  datasetV1Validation,
  datasetOfVesselIdV1Validation,
} = require('../validation/dataset.validation');
const encodeService = require('../service/encode.service');
const { redis } = require('../middleware/caching.middleware');

class DatasetRouter {
  static async getAllVessels(ctx) {
    const query = {
      limit: ctx.query.limit,
      offset: ctx.query.offset,
      query: ctx.query.query,
      ids: ctx.query.ids,
      queryFields: ctx.query.queryFields,
      suggestField: ctx.query.suggestField,
      querySuggestions: ctx.query.querySuggestions,
    };
    log.debug('Querying vessels search index');

    const results = await Promise.all(
      ctx.state.datasets.map(async dataset => {
        const result = await vesselService({
          dataset,
          version: ctx.state.datasetVersion,
        }).searchWithSuggest(query);
        return { dataset: dataset.id, results: result };
      }),
    );

    log.debug(`Returning ${results.entries.length} / ${results.total} results`);
    ctx.state.cacheTags = [`dataset`, `dataset-${ctx.params.dataset}`];

    await encodeService(ctx, 'DatasetVesselV1Query', ctx.query.binary)(results);
  }

  static async getVesselById(ctx) {
    try {
      const { vesselId } = ctx.params;
      const dataset = ctx.state.datasets[0];
      log.debug(`Looking up vessel information for vessel ${vesselId}`);
      const result = await vesselService({
        dataset,
        version: ctx.state.datasetVersion,
      }).get(vesselId);

      if (!result) {
        throw new NotFoundException();
      }

      log.debug('Returning vessel information');
      ctx.state.cacheTags = [
        `dataset`,
        'vessel',
        `dataset-${dataset.id}`,
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
  prefix: '/v1',
});
router.use(koa.obtainUser(false));

router.get(
  '/vessels',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueQueryParam: 'datasets' },
  ]),
  redis([]),
  datasetV1Validation,
  loadDatasetQueryMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-vessels'),
  DatasetRouter.getAllVessels,
);

router.get(
  '/vessels/:vesselId',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueQueryParam: 'datasets' },
  ]),
  redis([]),
  datasetOfVesselIdV1Validation,
  loadDatasetQueryMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-vessels'),
  DatasetRouter.getVesselById,
);

module.exports = router;
