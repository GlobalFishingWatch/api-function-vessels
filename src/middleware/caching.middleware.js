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
    return async (ctx, next) => {
      if (!config.redis.enabled) {
        await next();
        return;
      }
      const noCache = urlPatternsNotCache.find(p => p.match(ctx.path));
      if (noCache) {
        await next();
        return;
      }
      const exists = await redisCache.getBuffer(ctx.url);
      if (exists) {
        log.debug(`Returning cache for ${ctx.url}`);
        ctx.set('Content-Encoding', 'gzip');
        if (ctx.query.binary) {
          ctx.set('content-type', 'application/protobuf');
        } else {
          ctx.set('content-type', 'application/json; charset=utf-8');
        }
        ctx.remove('Content-Length');
        ctx.set('cached', 'true');
        ctx.body = exists;
        return;
      }
      await next();
      if (ctx.status === 200) {
        let result = ctx.body;
        try {
          result = await new Promise((resolve, reject) => {
            zlib.gzip(ctx.body, (err, data) => {
              if (err) {
                log.error('Error zipping response');
                reject(err);
                return;
              }
              resolve(data);
            });
          });
          await redisCache
            .set(ctx.url, result, ctx.state.cacheTags || [])
            .then(
              () => log.debug(`Cached ${ctx.url} `),
              err => log.error(`Error caching ${ctx.url}`, err),
            );
          ctx.set('Content-Encoding', 'gzip');
        } catch (err) {
          log.error(`Error saving cache for url ${ctx.url}`);
        }
        ctx.body = result;
      }
    };
  },
};
