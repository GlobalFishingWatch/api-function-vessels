const Joi = require('@hapi/joi');
const { VESSELS_CONSTANTS: { DEFAULT_PROPERTY_SUGGEST } } = require('../../constant');

const vesselDefault = {
  offset: 0,
  queryFields: [],
  suggestField: DEFAULT_PROPERTY_SUGGEST,
  limit: 10,
  binary: false,
};

const schemaGetAllVesselsV1 = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(25)
    .default(vesselDefault.limit),
  binary: Joi.boolean().default(vesselDefault.binary),
  ids: Joi.string().required(),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(vesselDefault.offset),
  datasets: Joi.string().required(),
});

const schemaGetVesselByIdV1 = Joi.object({
  binary: Joi.boolean().default(false),
  datasets: Joi.string().required(),
});

const schemaSearchVesselsV1 = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(25)
    .default(vesselDefault.limit),
  query: Joi.string().required(),
  binary: Joi.boolean().default(vesselDefault.binary),
  suggestField: Joi.string().default(vesselDefault.suggestField),
  queryFields: Joi.string().default(vesselDefault.queryFields),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(vesselDefault.offset),
  datasets: Joi.string().required(),
});

const schemaAdvancedSearchVesselsV1 = Joi.object({
  query: Joi.string().required(),
  datasets: Joi.string().required(),
  binary: Joi.boolean().default(vesselDefault.binary),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(vesselDefault.offset),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(25)
    .default(vesselDefault.limit),
});

module.exports= {
  schemaGetAllVesselsV1,
  schemaGetVesselByIdV1,
  schemaSearchVesselsV1,
  schemaAdvancedSearchVesselsV1,
}
