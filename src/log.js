const winston = require('winston');
const config = require('./config');
const { getPropertyFromNamespace } = require('./utils/get-property-from-namespace');
const { name } = require('../package.json');
const { TRANSACTION_ID: { NAMESPACE, PROPERTY } } = require('./constant');

const level2severity = {
  emerg: 'EMERGENCY',
  alert: 'ALERT',
  crit: 'CRITICAL',
  error: 'ERROR',
  warning: 'WARNING',
  notice: 'NOTICE',
  info: 'INFO',
  debug: 'DEBUG',
};

const severity = winston.format(info => {
  return {
    ...info,
    serviceName: name,
    transactionId: getPropertyFromNamespace(NAMESPACE, PROPERTY),
    severity: level2severity[info.level]
  };
});

module.exports = winston.createLogger({
  levels: winston.config.syslog.levels,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        severity(),
        winston.format.json(),
      ),
    }),
  ],
  level: config.log.level,
});
