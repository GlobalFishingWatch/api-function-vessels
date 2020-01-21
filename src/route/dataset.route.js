const Router = require('koa-router');
const {
  koa,
  errors: { NotFoundException },
} = require('auth-middleware');

const vesselService = require('../service/vessel.service');
const loadDatasetMiddleware = require('../middleware/load-dataset.middleware');
const log = require('../log');
const {
  datasetValidation,
  datasetOfVesselIdValidation,
} = require('../validation/dataset.validation');
const encodeService = require('../service/encode.service');

class DatasetRouter {
  static async getAllVessels(ctx) {
    const query = {
      query: ctx.query.query,
      limit: ctx.query.limit,
      offset: ctx.query.offset,
      queryFields: ctx.query.queryFields,
    };
    log.debug('Querying vessels search index');
    const results = await vesselService({
      dataset: ctx.state.dataset,
    }).search(query);

    log.debug(`Returning ${results.entries.length} / ${results.total} results`);
    ctx.state.cacheTags = [`dataset`, `dataset-${ctx.params.dataset}`];

    await encodeService(ctx, 'DatasetVesselQuery', ctx.query.binary)(results);
  }

  static async getVesselById(ctx) {
    try {
      const { vesselId } = ctx.params;
      log.debug(`Looking up vessel information for vessel ${vesselId}`);
      const result = await vesselService({ dataset: ctx.state.dataset }).get(
        vesselId,
      );

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
  prefix: '/datasets',
});
router.use(koa.obtainUser(true));

router.get(
  '/:dataset/vessels',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueParam: 'dataset' },
  ]),
  datasetValidation,
  loadDatasetMiddleware,
  DatasetRouter.getAllVessels,
);

router.get(
  '/:dataset/vessels/:vesselId',
  koa.checkPermissionsWithRequestParams([
    { action: 'read', type: 'dataset', valueParam: 'dataset' },
  ]),
  datasetOfVesselIdValidation,
  loadDatasetMiddleware,
  DatasetRouter.getVesselById,
);

module.exports = router;
