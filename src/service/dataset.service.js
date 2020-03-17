const {
  koa: { request },
} = require('auth-middleware');

module.exports = {
  async get(ctx, id) {
    const response = await request(ctx, {
      uri: `/datasets/${id}`,
      json: true,
    });

    return response;
  },

  async getMultiple(ctx, ids) {
    const response = await request(ctx, {
      uri: `/datasets?ids=${ids.join(',')}`,
      json: true,
    });
    return response;
  },
};
