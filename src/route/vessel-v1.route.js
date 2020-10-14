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
  vesselV1Validation,
  vesselIdV1Validation,
  vesselSearchV1Validation,
  advanceSearchSqlValidation,
} = require('../validation/vessel.validation');
const encodeService = require('../service/encode.service');
const { redis } = require('../middleware/caching.middleware');

class VesselRouter {

  static async getVesselsUsingAdvanceSearch(ctx) {
    log.info('Searching vessels using advance search');

    const query = {
      limit: ctx.query.limit,
      offset: ctx.query.offset,
      query: ctx.query.query,
    };

    const results = await Promise.all(
      ctx.state.datasets.map(async dataset => {
        const result = await vesselService({
          dataset,
          version: ctx.state.datasetVersion,
        }).advanceSearch(query);
        return { dataset: dataset.id, results: result };
      })
    )
    await encodeService(ctx, 'DatasetVesselInfo', ctx.query.binary)(results);
  }

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
  vesselV1Validation,
  loadDatasetQueryMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-vessels'),
  VesselRouter.getAllVessels,
);

router.get(
  '/vessels/search',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueQueryParam: 'datasets' },
  ]),
  redis([]),
  vesselSearchV1Validation,
  advanceSearchSqlValidation,
  loadDatasetQueryMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-vessels'),
  VesselRouter.getVesselsUsingAdvanceSearch,
);

router.get(
  '/vessels/:vesselId',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueQueryParam: 'datasets' },
  ]),
  redis([]),
  vesselIdV1Validation,
  loadDatasetQueryMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-vessels'),
  VesselRouter.getVesselById,
);

module.exports = router;
