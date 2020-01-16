const Joi = require('@hapi/joi');
const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');

const tilesetDefault = {
  offset: 0,
  queryFields: [],
  limit: 10,
  binary: false,
};
const schemaTileset = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(25)
    .default(tilesetDefault.limit),
  query: Joi.string().required(),
  binary: Joi.boolean().default(tilesetDefault.binary),
  queryFields: Joi.string().default(tilesetDefault.queryFields),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(tilesetDefault.offset),
});

const schemaVesselTileset = Joi.object({
  binary: Joi.boolean().default(tilesetDefault.binary),
});

async function tilesetValidation(ctx, next) {
  try {
    const value = await schemaTileset.validateAsync(ctx.request.query);

    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
    if (ctx.query.queryFields) {
      ctx.query.queryFields = ctx.query.queryFields.split(',');
    }
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
  await next();
}

async function tilesetOfVesselIdValidation(ctx, next) {
  try {
    const value = await schemaVesselTileset.validateAsync(ctx.request.query);
    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
  await next();
}
module.exports = { tilesetValidation, tilesetOfVesselIdValidation };
