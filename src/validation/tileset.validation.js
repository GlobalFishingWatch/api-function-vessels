const { query, param, validationResult } = require('express-validator');

const checkError = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next({ validation: errors.array() });
  }
  return next();
};
const tilesetValidation = [
  param('tileset').exists(),
  query('query').exists(),
  // limit (optional) should be number greather than 0. Default value 10
  query('limit')
    .optional()
    .isInt({ min: 1, max: 25 })
    .customSanitizer(value => parseInt(value, 10) || 10),
  // offset (optional) should be number greather than 0. Default value 0
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .customSanitizer(value => parseInt(value, 10) || 0),
  query('queryFields')
    .optional()
    .customSanitizer(value => value.split(',')),
  checkError,
];
const tilesetOfVesselIdValidation = [
  param('tileset').exists(),
  param('vesselId').exists(),
  checkError,
];

module.exports = {
  tilesetValidation,
  tilesetOfVesselIdValidation,
};
