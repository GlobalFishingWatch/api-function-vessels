const Router = require('koa-router');
const {
  koa,
  errors: { NotFoundException },
} = require('auth-middleware');
const checkDatasetTypeMiddleware = require('../middleware/check-type-dataset.middleware');
const setFieldsToSearchMiddleware = require('../middleware/set-fields-to-search.middleware');
const vesselService = require('../service/vessel.service');
const loadDatasetQueryMiddleware = require('../middleware/load-dataset-query.middleware');
const { log } = require('gfw-api-utils').logger;
const {
  getAllVesselsV1Validation,
  getVesselByIdV1Validation,
  getVesselSchemaV1Validation,
  searchVesselsV1Validation,
  advancedSearchSqlValidation,
  advancedSearchVesselsV1Validation,
} = require('../validation/vessel.validation');
const encodeService = require('../service/encode.service');
const { redis } = require('../middleware/caching.middleware');

class VesselRouter {
  static async getAllVessels(ctx) {
    const query = {
      limit: ctx.query.limit,
      offset: ctx.query.offset,
      ids: ctx.query.ids,
    };
    log.info(`Getting vessels with ids: ${query.ids}`);

    const results = await vesselService({
      datasets: ctx.state.datasets,
      version: ctx.state.datasetVersion,
    }).getAllVessels(query);

    log.info(`Returning ${results.entries.length} / ${results.total} results`);
    ctx.state.cacheTags = [`dataset`, `dataset-${ctx.params.dataset}`];
    await encodeService(ctx, 'DatasetVesselV1Query', ctx.query.binary)(results);
  }

  static async getVesselsSchema(ctx) {
    log.info(`Getting vessel schema`);

    const results = await vesselService({
      datasets: ctx.state.datasets,
      version: ctx.state.datasetVersion,
    }).getVesselsSchema();

    ctx.state.cacheTags = [`dataset`, `dataset-${ctx.params.dataset}`];
    await encodeService(ctx, 'DatasetVesselV1Query', ctx.query.binary)(results);
  }

  static async getVesselsUsingSearch(ctx) {
    log.info('Searching vessels using search');

    const query = {
      limit: ctx.query.limit,
      offset: ctx.query.offset,
      query: ctx.query.query,
      queryFields: ctx.query.queryFields,
      suggestField: ctx.query.suggestField,
    };

    const result = await vesselService({
      datasets: ctx.state.datasets,
      version: ctx.state.datasetVersion,
      fieldsToSearch: ctx.state.fieldsToSearch,
    }).searchWithSuggest(query);

    await encodeService(ctx, 'DatasetVesselInfo', ctx.query.binary)(result);
  }

  static async getVesselsUsingAdvanceSearch(ctx) {
    log.info(`Searching vessels using advance with query ${ctx.query.query}`);

    const query = {
      limit: ctx.query.limit,
      offset: ctx.query.offset,
      query: ctx.query.query,
    };

    const result = await vesselService({
      datasets: ctx.state.datasets,
      version: ctx.state.datasetVersion,
      fieldsToSearch: ctx.state.fieldsToSearch,
    }).advanceSearch(query);

    await encodeService(ctx, 'DatasetVesselInfo', ctx.query.binary)(result);
  }

  static async getVesselById(ctx) {
    try {
      const { vesselId } = ctx.params;
      const dataset = ctx.state.datasets[0];
      log.debug(`Looking up vessel information for vessel ${vesselId}`);
      const result = await vesselService({
        datasets: [dataset],
        version: ctx.state.datasetVersion,
      }).getOneById(vesselId);

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
  getAllVesselsV1Validation,
  loadDatasetQueryMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-vessels'),
  VesselRouter.getAllVessels,
);

router.get(
  '/vessels/schema',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueQueryParam: 'datasets' },
  ]),
  redis([]),
  getVesselSchemaV1Validation,
  loadDatasetQueryMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-vessels'),
  VesselRouter.getVesselsSchema,
);

router.get(
  '/vessels/search',
  koa.checkPermissionsWithRequestParams([
    { action: 'search', type: 'dataset', valueQueryParam: 'datasets' },
  ]),
  redis([]),
  searchVesselsV1Validation,
  loadDatasetQueryMiddleware('v1'),
  setFieldsToSearchMiddleware,
  checkDatasetTypeMiddleware('carriers-vessels'),
  VesselRouter.getVesselsUsingSearch,
);

router.get(
  '/vessels/advanced-search',
  koa.checkPermissionsWithRequestParams([
    { action: 'search', type: 'dataset', valueQueryParam: 'datasets' },
  ]),
  redis([]),
  advancedSearchVesselsV1Validation,
  loadDatasetQueryMiddleware('v1'),
  setFieldsToSearchMiddleware,
  advancedSearchSqlValidation,
  checkDatasetTypeMiddleware('carriers-vessels'),
  VesselRouter.getVesselsUsingAdvanceSearch,
);

router.get(
  '/vessels/:vesselId',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueQueryParam: 'datasets' },
  ]),
  redis([]),
  getVesselByIdV1Validation,
  loadDatasetQueryMiddleware('v1'),
  checkDatasetTypeMiddleware('carriers-vessels'),
  VesselRouter.getVesselById,
);

module.exports = router;
