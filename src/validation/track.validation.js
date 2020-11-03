const Joi = require('@hapi/joi');
const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');

const fields = [
  'fishing',
  'speed',
  'course',
  'lonlat',
  'timestamp',
  'night',
  'elevation_m',
  'distance_from_shore',
  'distance_from_port',
  'encounter',
  'fishing_hours',
];

const schemaTracksV1 = Joi.object({
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
  datasets: Joi.string().required(),
});
const schemaTracksV0 = Joi.object({
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

async function tracksV0Validation(ctx, next) {
  let value;
  try {
    value = await schemaTracksV0.validateAsync(ctx.request.query);
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
async function  tracksV1Validation(ctx, next) {
  let value;
  try {
    value = await schemaTracksV1.validateAsync(ctx.request.query);
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
  if (ctx.query.datasets) {
    ctx.query.datasets = ctx.query.datasets
      .split(',')
      .map(d => (d.indexOf(':') === -1 ? `${d}:latest` : d));
    if (ctx.query.datasets.length > 1) {
      throw new UnprocessableEntityException('Invalid query', [
        {
          path: ['datasets'],
          message: 'Only supported one dataset',
        },
      ]);
    }
  }

  await next();
}

module.exports = {
  tracksV1Validation,
  tracksV0Validation,
};
