const { StatusCodeError } = require('request-promise/errors');
const {
  koa: { request },
} = require('auth-middleware');

module.exports = {
  async get(ctx, id) {
    try {
      const response = await request(ctx, {
        uri: `/datasets/${id}`,
        json: true,
      });

      return response;
    } catch (err) {
      if (err instanceof StatusCodeError && err.statusCode === 404) {
        return undefined;
      }

      throw err;
    }
  },

  async getMultiple(ctx, ids) {
    try {
      const response = await request(ctx, {
        uri: `/datasets?ids=${ids.join(',')}`,
        json: true,
      });

      return response;
    } catch (err) {
      if (err instanceof StatusCodeError && err.statusCode === 404) {
        return undefined;
      }

      throw err;
    }
  },
};
