const Joi = require('@hapi/joi');
const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');
const { VESSELS_CONSTANTS: { DEFAULT_PROPERTY_SUGGEST } } = require('../constant');

const datasetDefault = {
  offset: 0,
  queryFields: [],
  suggestField: DEFAULT_PROPERTY_SUGGEST,
  querySuggestions: false,
  limit: 10,
  binary: false,
};
const schemaDatasetV0 = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(25)
    .default(datasetDefault.limit),
  query: Joi.string().required(),
  binary: Joi.boolean().default(datasetDefault.binary),
  suggestField: Joi.string().default(datasetDefault.suggestField),
  queryFields: Joi.string().default(datasetDefault.queryFields),
  querySuggestions: Joi.boolean().default(datasetDefault.querySuggestions),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(datasetDefault.offset),
});

const schemaVesselDatasetV0 = Joi.object({
  binary: Joi.boolean().default(false),
});
const schemaDatasetV1 = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(25)
    .default(datasetDefault.limit),
  query: Joi.string().required(),
  binary: Joi.boolean().default(datasetDefault.binary),
  suggestField: Joi.string().default(datasetDefault.suggestField),
  queryFields: Joi.string().default(datasetDefault.queryFields),
  querySuggestions: Joi.boolean().default(datasetDefault.querySuggestions),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(datasetDefault.offset),
  datasets: Joi.string().required(),
});

const schemaVesselDatasetV1 = Joi.object({
  binary: Joi.boolean().default(false),
  datasets: Joi.string().required(),
});

async function datasetV0Validation(ctx, next) {
  try {
    const value = await schemaDatasetV0.validateAsync(ctx.request.query);

    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
    if (ctx.query.queryFields && !Array.isArray(ctx.query.queryFields)) {
      ctx.query.queryFields = ctx.query.queryFields.split(',');
    }
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
  await next();
}

async function datasetOfVesselIdV0Validation(ctx, next) {
  try {
    const value = await schemaVesselDatasetV0.validateAsync(ctx.request.query);
    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
  await next();
}
async function datasetV1Validation(ctx, next) {
  try {
    const value = await schemaDatasetV1.validateAsync(ctx.request.query);

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

async function datasetOfVesselIdV1Validation(ctx, next) {
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
module.exports = {
  datasetV0Validation,
  datasetOfVesselIdV0Validation,
  datasetV1Validation,
  datasetOfVesselIdV1Validation,
};
