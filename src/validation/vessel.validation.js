const Joi = require('@hapi/joi');
const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');
const SqlWhereParser = require('sql-where-parser');
const { VESSELS_CONSTANTS: {
  DEFAULT_PROPERTY_SUGGEST, IMO, MMSI, SHIPNAME, VESSEL_ID, FLAG, CALLSIGN
}
} = require('../constant');
const { sanitizeSQL } = require('../utils/sanitize-sql')

function splitDatasets(datasetsFromQuery) {
  return datasetsFromQuery
    .split(',')
    .map(d => (d.indexOf(':') === -1 ? `${d}:latest` : d));
}

const vesselDefault = {
  offset: 0,
  queryFields: [],
  suggestField: DEFAULT_PROPERTY_SUGGEST,
  querySuggestions: false,
  limit: 10,
  binary: false,
};

const mainSchemaVesselV1 = {
  limit: Joi.number()
    .integer()
    .min(1)
    .max(25)
    .default(vesselDefault.limit),
  binary: Joi.boolean().default(vesselDefault.binary),
  suggestField: Joi.string().default(vesselDefault.suggestField),
  queryFields: Joi.string().default(vesselDefault.queryFields),
  querySuggestions: Joi.boolean().default(vesselDefault.querySuggestions),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(vesselDefault.offset),
  datasets: Joi.string().required(),
};
const schemaVesselV1 = Joi.alternatives().try(
  Joi.object().keys({
    ...mainSchemaVesselV1,
    query: Joi.string().required(),
  }),
  Joi.object().keys({
    ...mainSchemaVesselV1,
    ids: Joi.string().required(),
  }),
);
async function vesselV1Validation(ctx, next) {
  try {
    const value = await schemaVesselV1.validateAsync(ctx.request.query);

    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
    if (ctx.query.queryFields && !Array.isArray(ctx.query.queryFields)) {
      ctx.query.queryFields = ctx.query.queryFields.split(',');
    }
    if (ctx.query.ids && !Array.isArray(ctx.query.ids)) {
      ctx.query.ids = ctx.query.ids.split(',');
    }
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }

  if (ctx.query.datasets) {
    ctx.query.datasets = splitDatasets(ctx.query.datasets)
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
    ctx.query.datasets = splitDatasets(ctx.query.datasets)
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
  offset: Joi.number().default(vesselDefault.offset),
  limit: Joi.number().default(vesselDefault.limit),
  datasets: Joi.string().required(),
  query: Joi.string().required(),
});
async function vesselSearchV1Validation(ctx, next) {
  try {
    const value = await schemaVesselSearchV1.validateAsync(ctx.request.query);
    Object.keys(value).forEach(k => {
      ctx.query[k] = value[k];
    });
    if (ctx.query.datasets) {
      ctx.query.datasets = splitDatasets(ctx.query.datasets)
    }
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
  await next();
}

// Advance search SQL validation
function validateFields(where, fields) {
  if (Array.isArray(where)) {
    where.forEach((condition) => validateFields(condition, fields));
  } else {
    if (!where || typeof where === 'string') {
      throw new UnprocessableEntityException('Invalid Query: ', {
        message: 'Query malformed, remember to exclude where and use correct syntax.',
        path: ['query'],
      })
    }
    Object.keys(where).forEach((k) => {
      if (k.toLowerCase() === 'and' || k.toLowerCase() === 'or') {
        validateFields(where[k], fields);
      } else if (Array.isArray(where[k])) {
        if (
          !where[k].some((c) => fields.indexOf(c) >= 0)
        ) {
          throw new UnprocessableEntityException('Invalid Query: ', {
            message: `The column "${where[k][0].toUpperCase()}" is not supported to search. Supported columns: "${fields.map(f => f.toUpperCase())}"`,
            path: ['query'],
          })
        }
      } else {
        validateFields(where[k], fields);
      }
    });
  }
}
async function advanceSearchSqlValidation(ctx, next) {
  let { query: { query: sql } } = ctx;
  sql = sanitizeSQL(sql)
  const fieldsAllowed = [IMO, MMSI, SHIPNAME, VESSEL_ID, FLAG, CALLSIGN];
  let whereParsed;
  try {
    const parser = new SqlWhereParser();
    whereParsed = parser.parse(sql);
  } catch (err) {
    throw new UnprocessableEntityException('Invalid Query: ', {
      message: `Query malformed, remember to exclude where and use correct syntax.`,
      path: ['query'],
    })
  }
  validateFields(whereParsed, fieldsAllowed);
  ctx.query.query.sql = sql;
  await next()
}

module.exports = {
  vesselV1Validation,
  vesselIdV1Validation,
  vesselSearchV1Validation,
  advanceSearchSqlValidation,
};
