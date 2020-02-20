const RedisCache = require('./redis-tag-cache');
const config = require('../config');

let cache = null;
if (config.redis.enabled) {
  cache = new RedisCache({
    redis: {
      port: config.redis.port,
      host: config.redis.host,
      return_buffers: true,
    },
    defaultTimeout: 86400, // Expire records after a day (even if they weren't invalidated)
  });
}

module.exports = cache;
