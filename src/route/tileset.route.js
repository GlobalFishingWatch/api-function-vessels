const Router = require('koa-router');
const {
  koa,
  errors: { NotFoundException },
} = require('auth-middleware');
const vesselService = require('../service/vessel.service');
const { log } = require('gfw-api-utils').logger;
const {
  tilesetOfVesselIdValidation,
  tilesetValidation,
} = require('../validation/tileset.validation');
const { checkTileset } = require('../middleware/permissions.middleware');
const { redis } = require('../middleware/caching.middleware');
const encodeService = require('../service/encode.service');

class TilesetRouter {
  static async getAllVessels(ctx) {
    const query = {
      query: ctx.query.query,
      limit: ctx.query.limit,
      offset: ctx.query.offset,
      queryFields: ctx.query.queryFields,
      querySuggestions: ctx.query.querySuggestions,
    };

    log.debug('Querying vessels search index');
    const results = await vesselService({
      tileset: ctx.params.tileset,
    }).search(query);

    log.debug(`Returning ${results.entries.length} / ${results.total} results`);
    ctx.state.cacheTags = [`tileset`, `tileset-${ctx.params.tileset}`];
    await encodeService(ctx, 'TilesetVesselQuery', ctx.query.binary)(results);
  }

  static async getVesselById(ctx) {
    try {
      const { vesselId } = ctx.params;

      log.debug(`Looking up vessel information for vessel ${vesselId}`);
      const result = await vesselService({
        tileset: ctx.params.tileset,
      }).getOneById(vesselId);

      log.debug('Returning vessel information');
      ctx.state.cacheTags = [
        `tileset`,
        'vessel',
        `tileset-${ctx.params.tileset}`,
        `vessel-${vesselId}`,
      ];
      return encodeService(ctx, 'TilesetVesselInfo', ctx.query.binary)(result);
    } catch (error) {
      if (error.statusCode && error.statusCode === 404) {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}

const router = new Router({
  prefix: '/tilesets',
});

router.use(koa.obtainUser(false));

router.get(
  '/:tileset/vessels',
  checkTileset(),
  redis([]),
  tilesetValidation,
  TilesetRouter.getAllVessels,
);

router.get(
  '/:tileset/vessels/:vesselId',
  checkTileset(),
  redis([]),
  tilesetOfVesselIdValidation,
  TilesetRouter.getVesselById,
);
module.exports = router;
