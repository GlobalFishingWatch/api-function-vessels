const RedisCache = require('./redis-tag-cache');
const config = require('../config');

const cache = new RedisCache({
  redis: {
    port: config.redis.port,
    host: config.redis.host,
    return_buffers: true
  },
  defaultTimeout: 86400 // Expire records after a day (even if they weren't invalidated)
});

module.exports = cache;
