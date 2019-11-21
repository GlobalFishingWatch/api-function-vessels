const { query, param, validationResult } = require('express-validator');

const features = ['fishing', 'speed', 'course'];

const tracksValidation = [
  param('dataset').exists(),
  param('vesselId').exists(),
  // startDate is required and ISO Date format
  query('startDate')
    .optional()
    .isISO8601(),
  // endDate is required and ISO Date format and greather than startDate
  query('endDate')
    .optional()
    .isISO8601()
    .bail()
    .custom(
      (value, { req }) => new Date(req.query.startDate) < new Date(value),
    ),
  // features is optional and list of items of features list
  query('features')
    .optional()
    .bail()
    .custom(value => !value.split(',').some(f => features.indexOf(f) === -1))
    .customSanitizer(value => value.split(',')),
  // features is in (points or lines) and default value lines
  query('format')
    .isIn(['lines', 'points', null])
    .customSanitizer(value => value || 'lines'),
  query('wrapLongitudes')
    .toBoolean()
    .customSanitizer(value => value || false),
  query('binary')
    .toBoolean()
    .customSanitizer(value => value || false),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next({ validation: errors.array() });
    }
    return next();
  },
];

module.exports = {
  tracksValidation,
};
