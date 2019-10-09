const zlib = require('zlib');
const UrlPattern = require('url-pattern');
const redisCache = require('../db/redis');
const config = require('../config');
const log = require('../log');

module.exports = {
  withStaticTTL(ttl) {
    return (req, res, next) => {
      if (ttl) {
        res.set('Cache-Control', `private, max-age=${ttl}`);
      }
      next();
    };
  },
  redis(patternsNotCache = []) {
    const urlPatternsNotCache = patternsNotCache.map(p => new UrlPattern(p));
    return async (req, res, next) => {
      try {
        if (!config.redis.enabled) {
          next();
          return;
        }
        const noCache = urlPatternsNotCache.find(p => p.match(req.path));
        if (noCache) {
          next();
          return;
        }
        const exists = await redisCache.getBuffer(req.url);
        if (exists) {
          log.debug(`Returning cache for ${req.url}`);
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
                  body,
                  { level: zlib.Z_BEST_COMPRESSION },
                  (err, data) => {
                    if (err) {
                      log.error('Error zipping response');
                      reject(err);
                      return;
                    }
                    resolve(data);
                  },
                );
              });
              await redisCache
                .set(req.url, result, res.locals.cacheTags || [])
                .then(
                  () => log.debug(`Cached ${req.url} `),
                  err => log.error(`Error caching ${req.url}`, err),
                );
            } catch (err) {
              log.error(`Error saving cache for url ${req.url}`);
            }
          }

          res.sendResponse(body);
        };
        next();
      } catch (err) {
        next(err);
      }
    };
  },
};
