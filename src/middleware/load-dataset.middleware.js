const datasets = require('../service/dataset.service');
const log = require('../log');

module.exports = async (req, res, next) => {
  try {
    const datasetId = req.params.dataset;

    log.debug(`Loading dataset ${datasetId}`);
    const dataset = await datasets.get(datasetId);
    if (!dataset) {
      log.debug(`Unable to load dataset ${datasetId}`);
      return res.sendStatus(404);
    }
    res.locals.dataset = dataset;
    return next();
  } catch (err) {
    return next(err);
  }
};
