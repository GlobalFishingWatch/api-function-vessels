const Joi = require('@hapi/joi');
const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');

const features = ['fishing', 'speed', 'course'];

const schemaTracks = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().when('min', {
    is: Joi.date().iso(),
    then: Joi.date().greater(Joi.ref('startDate')),
  }),
  features: Joi.string(),
  format: Joi.string()
    .allow('lines', 'points')
    .default('lines'),
  query: Joi.boolean().default(false),
  binary: Joi.boolean().default(false),
});

async function tracksValidation(ctx, next) {
  try {
    const value = await schemaTracks.validateAsync(ctx.request.query);

    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
    if (ctx.query.features) {
      const invalid = ctx.query.features
        .split(',')
        .some(f => features.indexOf(f) === -1);
      if (invalid) {
        throw new UnprocessableEntityException('Invalid query', []);
      }
      ctx.query.features = ctx.query.features.split(',');
    } else {
      ctx.query.features = [];
    }
    await next();
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
}

module.exports = {
  tracksValidation,
};
