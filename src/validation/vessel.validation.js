const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');
const SqlWhereParser = require('sql-where-parser');
const { removeWhitespace } = require('../utils/remove-whitespace');
const { splitDatasets } = require('../utils/split-datasets');
const {
  schemaGetAllVesselsV1,
  schemaGetVesselByIdV1,
  schemaGetVesselSchemaV1,
  schemaSearchVesselsV1,
  schemaAdvancedSearchVesselsV1
} = require('./schemas/vessel.schemas');

async function validateSchema(ctx, schema) {
  const value = await schema.validateAsync(ctx.request.query);
  Object.keys(value).forEach(k => {
    ctx.query[k] = value[k];
  });
}

async function getAllVesselsV1Validation(ctx, next) {
  try {
    await validateSchema(ctx, schemaGetAllVesselsV1)
    if (ctx.query.ids && !Array.isArray(ctx.query.ids)) {
      ctx.query.ids = ctx.query.ids.split(',');
    }
    if (ctx.query.datasets) {
      ctx.query.datasets = splitDatasets(ctx.query.datasets)
    }
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
  await next();
}


async function getVesselByIdV1Validation(ctx, next) {
  try {
    await validateSchema(ctx, schemaGetVesselByIdV1)
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

async function getVesselSchemaV1Validation(ctx, next) {
  try {
    await validateSchema(ctx, schemaGetVesselSchemaV1)
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
  if (ctx.query.datasets) {
    ctx.query.datasets = splitDatasets(ctx.query.datasets);
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

async function searchVesselsV1Validation(ctx, next) {
  try {
    await validateSchema(ctx, schemaSearchVesselsV1)
    if (ctx.query.queryFields && !Array.isArray(ctx.query.queryFields)) {
      ctx.query.queryFields = ctx.query.queryFields.split(',');
    }
    if (ctx.query.datasets) {
      ctx.query.datasets = splitDatasets(ctx.query.datasets);
    }
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
  await next();
}

function validateFields(where, fields) {

  if (Array.isArray(where)) {
    where.forEach((condition) => validateFields(condition, fields));
    return;
  }

  if (!where || typeof where === 'string') {
    throw new UnprocessableEntityException('Invalid Query: ', {
      message: 'Query malformed, remember to exclude where and use correct syntax.',
      path: ['query'],
    })
  }

  Object.keys(where).forEach((k) => {
    if (k.toLowerCase() === 'and' || k.toLowerCase() === 'or') {
      validateFields(where[k], fields);
      return;
    }
    if (Array.isArray(where[k]) && !where[k].some((c) => fields.indexOf(c) >= 0)) {
      throw new UnprocessableEntityException('Invalid Query: ', {
        message: `The column "${where[k][0].toUpperCase()}" is not supported to search. Supported columns: "${fields.map(f => f.toUpperCase())}"`,
        path: ['query'],
      })
    }
    if (!Array.isArray(where[k])) {
      validateFields(where[k], fields);
    }
  });

}
async function advancedSearchSqlValidation(ctx, next) {
  try {
    const { query: { query: sql } } = ctx;
    const parser = new SqlWhereParser();
    const whereParsed = parser.parse(removeWhitespace(sql));
    validateFields(whereParsed, ctx.state.fieldsToSearch);
    ctx.query.query = removeWhitespace(sql);
  } catch (err) {
    throw new UnprocessableEntityException('Invalid Query: ', {
      message: `Invalid query, remember to exclude where and use correct syntax. Fields allowed ${ctx.state.fieldsToSearch}`,
      path: ['query'],
    })
  }
  await next()
}
async function advancedSearchVesselsV1Validation(ctx, next) {
  try {
    await validateSchema(ctx, schemaAdvancedSearchVesselsV1)
    if (ctx.query.datasets) {
      ctx.query.datasets = splitDatasets(ctx.query.datasets);
    }
  } catch (err) {
    throw new UnprocessableEntityException('Invalid query', err.details);
  }
  await next();
}

module.exports = {
  getAllVesselsV1Validation,
  getVesselByIdV1Validation,
  getVesselSchemaV1Validation,
  searchVesselsV1Validation,
  advancedSearchSqlValidation,
  advancedSearchVesselsV1Validation,
};
