const vesselService = require('../service/vessel.service');
const loadDatasetMiddleware = require('../middleware/load-dataset.middleware');
const log = require('../log');
const {
  datasetOfVesselIdValidation,
  datasetValidation,
} = require('../validation/dataset.validation');
const encodeService = require('../service/encode.service');

module.exports = app => {
  app.get(
    '/datasets/:dataset/vessels',
    datasetValidation,
    loadDatasetMiddleware,
    async (req, res, next) => {
      try {
        const query = {
          query: req.query.query,
          limit: req.query.limit,
          offset: req.query.offset,
          queryFields: req.query.queryFields,
        };
        log.debug('Querying vessels search index');
        const results = await vesselService({
          dataset: res.locals.dataset,
        }).search(query);

        log.debug(
          `Returning ${results.entries.length} / ${results.total} results`,
        );
        res.locals.cacheTags = [`dataset`, `dataset-${req.params.dataset}`];

        encodeService(res, 'DatasetVesselQuery', req.query.binary)(results);
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/datasets/:dataset/vessels/:vesselId',
    datasetOfVesselIdValidation,
    loadDatasetMiddleware,
    async (req, res, next) => {
      try {
        const { vesselId } = req.params;
        log.debug(`Looking up vessel information for vessel ${vesselId}`);
        const result = await vesselService({ dataset: res.locals.dataset }).get(
          vesselId,
        );

        log.debug('Returning vessel information');
        res.locals.cacheTags = [
          `dataset`,
          'vessel',
          `dataset-${req.params.dataset}`,
          `vessel-${vesselId}`,
        ];
        return encodeService(res, 'DatasetVesselInfo', req.query.binary)(
          result,
        );
      } catch (error) {
        if (error.statusCode && error.statusCode === 404) {
          return res.sendStatus(404);
        }
        return next(error);
      }
    },
  );
};
