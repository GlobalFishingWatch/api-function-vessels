const Joi = require('@hapi/joi');
const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');

const fields = ['fishing', 'speed', 'course', 'lonlat', 'timestamp'];

const schemaTracks = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().when('min', {
    is: Joi.date().iso(),
    then: Joi.date().greater(Joi.ref('startDate')),
  }),
  format: Joi.string()
    .allow('lines', 'points', 'valueArray')
    .default('lines'),
  query: Joi.boolean().default(false),
  binary: Joi.boolean().default(false),
  fields: Joi.string(),
  wrapLongitudes: Joi.boolean().default(false),
});

async function tracksValidation(ctx, next) {
  let value;
  try {
    value = await schemaTracks.validateAsync(ctx.request.query);
    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }

  if (ctx.query.fields) {
    const invalid = ctx.query.fields
      .split(',')
      .some(f => fields.indexOf(f) === -1);
    if (invalid) {
      throw new UnprocessableEntityException('Invalid query', [
        {
          path: ['fields'],
          message: 'Invalid query fields',
        },
      ]);
    }
    ctx.query.fields = ctx.query.fields.split(',');
  } else {
    ctx.query.fields = [];
  }

  await next();
}

module.exports = {
  tracksValidation,
};
