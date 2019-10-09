const Redis = require('ioredis');

class TagCache {
  constructor(options = {}) {
    this.redis = new Redis(options.redis || {});
    this.options = options;
  }

  async get(...keys) {
    try {
      return this.redis.mget(keys.map(key => `data:${key}`)).then(res => {
        try {
          // Special case for single element gets
          if (res.length === 1) return res[0];
          return res;
        } catch (err) {
          return res;
        }
      });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getBuffer(...keys) {
    try {
      return this.redis.mgetBuffer(keys.map(key => `data:${key}`)).then(res => {
        try {
          // Special case for single element gets
          if (res.length === 1) return res[0];
          return res;
        } catch (err) {
          return res;
        }
      });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async set(key, data, tags, options = {}) {
    // NOTE(@mxstbr): This is a multi execution because if any of the commands is invalid
    // we don't want to execute anything
    const multi = await this.redis.multi();

    // Add the key to each of the tag sets
    tags.forEach(tag => {
      multi.sadd(`tags:${tag}`, key);
    });
    const timeout = (options && options.timeout) || this.options.defaultTimeout;
    // Add the data to the key
    if (typeof timeout === 'number') {
      multi.set(`data:${key}`, data, 'ex', timeout);
    } else {
      multi.set(`data:${key}`, data);
    }
    await multi.exec();
  }

  // How invalidation by tag works:
  // 1. Get all the keys associated with all the passed-in tags (tags:${tag})
  // 2. Delete all the keys data (data:${key})
  // 3. Delete all the tags (tags:${tag})
  async invalidate(...tags) {
    try {
      // NOTE(@mxstbr): [].concat.apply([],...) flattens the array
      // eslint-disable-next-line prefer-spread
      const keys = [].concat.apply(
        [],
        await Promise.all(tags.map(tag => this.redis.smembers(`tags:${tag}`))),
      );

      const pipeline = await this.redis.pipeline();

      keys.forEach(key => {
        pipeline.del(`data:${key}`);
      });

      tags.forEach(tag => {
        pipeline.del(`tags:${tag}`);
      });

      await pipeline.exec();
      return true;
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

module.exports = TagCache;
