const Joi = require('@hapi/joi');
const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');
const { VESSELS_CONSTANTS: { DEFAULT_PROPERTY_SUGGEST } } = require('../constant');

const vesselDefault = {
  offset: 0,
  queryFields: [],
  suggestField: DEFAULT_PROPERTY_SUGGEST,
  querySuggestions: false,
  limit: 10,
  binary: false,
};

const schemaVesselV1 = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(25)
    .default(vesselDefault.limit),
  query: Joi.string().required(),
  binary: Joi.boolean().default(vesselDefault.binary),
  suggestField: Joi.string().default(vesselDefault.suggestField),
  queryFields: Joi.string().default(vesselDefault.queryFields),
  querySuggestions: Joi.boolean().default(vesselDefault.querySuggestions),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(vesselDefault.offset),
  datasets: Joi.string().required(),
});
async function vesselV1Validation(ctx, next) {
  try {
    const value = await schemaVesselV1.validateAsync(ctx.request.query);

    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
    if (ctx.query.queryFields && !Array.isArray(ctx.query.queryFields)) {
      ctx.query.queryFields = ctx.query.queryFields.split(',');
    }
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }

  if (ctx.query.datasets) {
    ctx.query.datasets = ctx.query.datasets
      .split(',')
      .map(d => (d.indexOf(':') === -1 ? `${d}:latest` : d));
  }
  await next();
}


const schemaVesselDatasetV1 = Joi.object({
  binary: Joi.boolean().default(false),
  datasets: Joi.string().required(),
});
async function vesselIdV1Validation(ctx, next) {
  try {
    const value = await schemaVesselDatasetV1.validateAsync(ctx.request.query);
    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
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

const schemaVesselSearchV1 = Joi.object({
  datasets: Joi.array().items(Joi.string()),
  query: Joi.object({
    term: Joi.string(),
    fields: Joi.array().items(Joi.string())
  }),
});
async function vesselSearchValidation(ctx, next) {
  try {
    const value = await schemaVesselSearchV1.validateAsync(ctx.request.body);
    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
  } catch (err) {
    throw new UnprocessableEntityException('Invalid body', err.details);
  }
  await next();
}


module.exports = {
  vesselV1Validation,
  vesselIdV1Validation,
  vesselSearchValidation
};
