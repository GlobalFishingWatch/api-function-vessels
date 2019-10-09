const datasets = require('../services/dataset.service');
const tracks = require('../services/tracks.service');
const log = require('../log');

const loadDataset = async (req, res, next) => {
  try {
    const datasetId = req.params.dataset;

    log.debug(`Loading dataset ${datasetId}`);
    const dataset = await datasets.get(datasetId);
    if (!dataset) {
      log.debug(`Unable to load dataset ${datasetId}`);
      return res.sendStatus(404);
    }
    req.dataset = dataset;
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = app => {
  app.get(
    '/datasets/:dataset/vessels/:vesselId/tracks',
    loadDataset,
    async (req, res, next) => {
      try {
        const vesselId = req.params.vesselId;
        const params = {
          startDate: req.params.startDate,
          endDate: req.params.endDate
        };
        const format = req.params.format || 'lines';
        const features = req.params.features
          ? req.params.features.split(',')
          : [];

        log.debug(
          `Configuring track loader for dataset ${req.dataset} using additional features ${features}`
        );
        const trackLoader = tracks({
          dataset: req.dataset,
          additionalFeatures: features,
          params
        });

        log.debug(`Looking up track for vessel ${vesselId}`);
        const records = await trackLoader.load(vesselId);

        log.debug(`Converting the records to format ${format}`);
        const result = trackLoader.formatters[format](records);

        log.debug(`Returning track for vessel ${vesselId}`);
        return res.json(result);
      } catch (error) {
        return next(error);
      }
    }
  );
};
