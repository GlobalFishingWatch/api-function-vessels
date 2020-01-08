const Joi = require('@hapi/joi');
const { UnprocessableEntityException } = require('../errors/http.error');

const datasetDefault = {
  offset: 0,
  queryFields: [],
  limit: 10,
  binary: false,
};
const schemaDataset = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(25)
    .default(datasetDefault.limit),
  query: Joi.string().required(),
  binary: Joi.boolean().default(datasetDefault.binary),
  queryFields: Joi.string().default(datasetDefault.queryFields),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(datasetDefault.offset),
});

const schemaVesselDataset = Joi.object({
  binary: Joi.boolean().default(false),
});

async function datasetValidation(ctx, next) {
  try {
    const value = await schemaDataset.validateAsync(ctx.request.query);

    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
    if (ctx.query.queryFields && !Array.isArray(ctx.query.queryFields)) {
      ctx.query.queryFields = ctx.query.queryFields.split(',');
    }
    await next();
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
}

async function datasetOfVesselIdValidation(ctx, next) {
  try {
    const value = await schemaVesselDataset.validateAsync(ctx.request.query);
    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
    await next();
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
}
module.exports = { datasetValidation, datasetOfVesselIdValidation };
