const Knex = require('knex');
const config = require('../config');
const log = require('../log');

module.exports = new Knex({
  client: 'pg',
  connection: {
    user: config.gcloud.sqlFishing.user,
    password: config.gcloud.sqlFishing.password,
    database: config.gcloud.sqlFishing.db,
    host: `/cloudsql/${config.gcloud.sqlFishing.instance}`,
  },
  pool: { min: 1, max: 1 },
  debug: config.log.level === 'debug',
  log: {
    warn(message) {
      log.warn(message);
    },
    error(message) {
      log.error(message);
    },
    deprecate(message) {
      log.warn(message);
    },
    debug(message) {
      log.debug(message);
    },
  },
});
