const redisCache = require('../db/redis');
const config = require('../config');
const log = require('../log');
const zlib = require('zlib');
const DAY_SECONDS = 24 * 60 * 60;
module.exports = {
  withStaticTTL(ttl) {
    return (req, res, next) => {
      if (ttl) {
        res.set('Cache-Control', `private, max-age=${ttl}`);
      }
      next();
    };
  },
  redis() {
    return async (req, res, next) => {
      try {
        if (!config.redis.enabled) {
          next();
          return;
        }
        const exists = await redisCache.getAsync(req.url);
        if (exists) {
          console.log(exists);
          log.debug(`Returning cache for ${req.url}`);
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Content-Type', 'application/json');
          res.removeHeader('Content-Length');
          res.send(exists);
          return;
        }
        res.sendResponse = res.send;
        res.send = async body => {
          if (res.statusCode === 200) {
            try {
              const result = await new Promise((resolve, reject) => {
                zlib.gzip(
                  JSON.stringify(body),
                  { level: zlib.Z_BEST_COMPRESSION },
                  (err, result) => {
                    if (err) {
                      log.error('Error zipping response');
                      reject(err);
                      return;
                    }
                    resolve(result);
                  }
                );
              });
              await redisCache
                .setAsync(req.url, result, 'EX', DAY_SECONDS)
                .then(
                  _ => log.debug(`Cached ${req.url} `),
                  err => log.error(`Error caching ${req.url}`, err)
                );
            } catch (err) {
              log.error(`Error saving cache for url ${req.url}`);
            }
          }

          res.sendResponse(body);
        };
        return next();
      } catch (err) {
        return next(err);
      }
    };
  }
};
