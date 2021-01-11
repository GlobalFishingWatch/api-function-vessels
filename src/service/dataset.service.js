const {
  koa: { request },
} = require('auth-middleware');

module.exports = {
  async get(ctx, id, version) {
    const response = await request(ctx, {
      uri: `${version === 'v1' ? '/v1' : ''}/datasets/${id}?cache=false`,
      json: true,
    });

    return response;
  },

  async getMultiple(ctx, ids, version) {
    const response = await request(ctx, {
      uri: `${
        version === 'v1' ? '/v1' : ''
      }/datasets?cache=false&ids=${ids.join(',')}`,
      json: true,
    });
    return response;
  },
};
