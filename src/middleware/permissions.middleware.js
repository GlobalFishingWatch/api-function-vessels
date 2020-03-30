const log = require('../log');
const {
  koa: { request, checkPermissions },
} = require('auth-middleware');

async function getDatasetByTileset(ctx, tileset) {
  return request(ctx, {
    uri: `/datasets?tileset=${tileset}`,
    json: true,
  });
}

module.exports = {
  checkTileset() {
    return async (ctx, next) => {
      let dataset;
      const { tileset } = ctx.params;
      try {
        dataset = await getDatasetByTileset(ctx, tileset);
      } catch (err) {
        log.error('Error obtaining datasets ', err);
        throw err;
      }
      try {
        if (!dataset || dataset.length === 0) {
          log.debug('tileset is public');
          await next();
          return;
        }
      } catch (err) {
        log.error('Error in next ', err);
        throw err;
      }
      try {
        await checkPermissions([
          { action: 'read', type: 'dataset', value: dataset[0].id },
        ])(ctx, next);
      } catch (err) {
        log.error('Error checking permissions ', err);
        throw err;
      }
    };
  },
};
