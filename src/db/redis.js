const RedisCache = require('redis-tag-cache').default;
const config = require('../config');
const { promisify } = require('util');

var redis = require('redis'),
  client = redis.createClient({
    port: config.redis.port,
    host: config.redis.host,
    return_buffers: true
  });
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
client.getAsync = getAsync;
client.setAsync = setAsync;
// const cache = new RedisCache({
//   redis: {
//     port: config.redis.port,
//     host: config.redis.host,
//     return_buffers: true
//   },
//   defaultTimeout: 86400 // Expire records after a day (even if they weren't invalidated)
// });

module.exports = client;
