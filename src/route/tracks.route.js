const loadDatasetMiddleware = require('../middleware/load-dataset.middleware');
const trackService = require('../service/tracks.service');
const log = require('../log');
const { tracksValidation } = require('../validation/track.validation');
const encodeService = require('../service/encode.service');

module.exports = app => {
  app.get(
    '/datasets/:dataset/vessels/:vesselId/tracks',
    tracksValidation,
    loadDatasetMiddleware,
    async (req, res, next) => {
      try {
        const { vesselId } = req.params;
        const params = {
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          wrapLongitudes: req.query.wrapLongitudes,
        };

        const { format } = req.query;
        const { features } = req.query;
        const { binary } = req.query;

        log.debug(
          `Configuring track loader for dataset ${res.locals.dataset} using additional features ${features}`,
        );
        const trackLoader = trackService({
          dataset: res.locals.dataset,
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
        res.locals.cacheTags = [
          'tracks',
          `tracks-${req.params.dataset}`,
          'vessel',
          `vessel-${vesselId}`,
        ];

        for (let i = startYear; i <= endYear; i++) {
          res.locals.cacheTags.push(`tracks-${req.params.dataset}-${i}`);
          res.locals.cacheTags.push(`tracks-year-${i}`);
        }
        log.debug(`Returning track for vessel ${vesselId}`);

        encodeService(res, 'geojson', binary)(result);
      } catch (err) {
        return next(err);
      }
    },
  );
};
