const Pbf = require('pbf');
const geobuf = require('geobuf');
const loadDatasetMiddleware = require('../middleware/load-dataset.middleware');
const trackService = require('../service/tracks.service');
const log = require('../log');
const { tracksValidation } = require('../validation/track.validation');

function encodeResponse(res, binary = false) {
  return data => {
    if (binary) {
      const pbf = geobuf.encode(data, new Pbf());
      const buffer = Buffer.from(pbf);
      res.set('content-type', 'application/protobuf');
      res.send(buffer);
    } else {
      res.set('content-type', 'application/json; charset=utf-8');
      res.json(data);
    }
  };
}

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

        encodeResponse(res, binary)(result);
      } catch (err) {
        return next(err);
      }
    },
  );
};
