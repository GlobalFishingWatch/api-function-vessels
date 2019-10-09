const basicAuth = require('express-basic-auth');
const datasets = require('../services/dataset.service');
const tracks = require('../services/tracks.service');
const log = require('../log');
const config = require('../config');
const redisCache = require('../db/redis');

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
    '/cache/flush/:tag',
    basicAuth({
      users: {
        [config.auth.username]: config.auth.password,
      },
      challenge: true,
      realm: 'API-Vessels-Tracks',
    }),
    async (req, res, next) => {
      try {
        await redisCache.invalidate(req.params.tag);
        res.json({ [req.params.tag]: 'ok' });
      } catch (err) {
        log.error('Error flushing cache');
        next(err);
      }
    },
  );
  app.get(
    '/cache/flush-all',
    basicAuth({
      users: {
        [config.auth.username]: config.auth.password,
      },
      challenge: true,
      realm: 'API-Vessels-Tracks',
    }),
    async (req, res, next) => {
      try {
        await redisCache.redis.flushdb();
        res.json({ flushall: 'ok' });
      } catch (err) {
        log.error('Error flushing cache');
        next(err);
      }
    },
  );
  app.get(
    '/datasets/:dataset/vessels/:vesselId/tracks',
    loadDataset,
    async (req, res, next) => {
      try {
        const { vesselId } = req.params;
        const params = {
          startDate: req.query.startDate,
          endDate: req.query.endDate,
        };
        const format = req.query.format || 'lines';
        const features = req.query.features
          ? req.query.features.split(',')
          : [];

        log.debug(
          `Configuring track loader for dataset ${req.dataset} using additional features ${features}`,
        );
        const trackLoader = tracks({
          dataset: req.dataset,
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
        res.locals.cacheTags = [];

        for (let i = startYear; i <= endYear; i++) {
          res.locals.cacheTags.push(`tracks-${i}`);
        }
        log.debug(`Returning track for vessel ${vesselId}`);
        return res.json(result);
      } catch (err) {
        return next(err);
      }
    },
  );
};
