const auth = require('koa-basic-auth');
const Router = require('koa-router');
const { log } = require('gfw-api-utils').logger;
const config = require('../config');
const redisCache = require('../db/redis');

class CacheRouter {
  static async flushAll(ctx) {
    try {
      await redisCache.redis.flushall();
      ctx.body = { flushall: 'ok' };
    } catch (err) {
      log.error('Error flushing cache');
      throw err;
    }
  }

  static async flushByTag(ctx) {
    try {
      await redisCache.invalidate(ctx.params.tag);
      ctx.body = { [ctx.params.tag]: 'ok' };
    } catch (err) {
      log.error('Error flushing cache');
      throw err;
    }
  }
}

const router = new Router({
  prefix: '/cache',
});
router.use(auth({ name: config.auth.username, pass: config.auth.password }));

router.get('/flush/:tag', CacheRouter.flushByTag);
router.get('/flush-all', CacheRouter.flushAll);

module.exports = router;
