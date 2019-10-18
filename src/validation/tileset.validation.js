const { query, param, validationResult } = require('express-validator');

const tilesetDefault = {
  offset: 0,
  queryFields: [],
  limit: 10,
  binary: false,
};
const checkError = defaultValue => (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next({ validation: errors.array() });
  }
  req.query = { ...defaultValue, ...req.query };
  return next();
};
const tilesetValidation = [
  param('tileset').exists(),
  query('query').exists(),
  // limit (optional) should be number greather than 0. Default value 10
  query('limit')
    .optional()
    .isInt({ min: 1, max: 25 })
    .toInt(10),
  // offset (optional) should be number greather than 0. Default value 0
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .toInt(10),
  query('queryFields')
    .optional()
    .customSanitizer(value => value.split(',')),
  query('binary')
    .toBoolean()
    .customSanitizer(value => value || false),
  checkError(tilesetDefault),
];
const tilesetOfVesselIdValidation = [
  param('tileset').exists(),
  param('vesselId').exists(),
  query('binary')
    .toBoolean()
    .customSanitizer(value => value || false),
  checkError({ binary: false }),
];

module.exports = {
  tilesetValidation,
  tilesetOfVesselIdValidation,
};
