const basicAuth = require('express-basic-auth');
const log = require('../log');
const config = require('../config');
const redisCache = require('../db/redis');

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
        await redisCache.redis.flushall();
        res.json({ flushall: 'ok' });
      } catch (err) {
        log.error('Error flushing cache');
        next(err);
      }
    },
  );
};
