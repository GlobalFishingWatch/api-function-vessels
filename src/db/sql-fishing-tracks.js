const Knex = require('knex');
const config = require('../config');
const { log } = require('gfw-api-utils').logger;

module.exports = new Knex({
  client: 'pg',
  connection: {
    user: config.gcloud.sqlFishingTracks.user,
    password: config.gcloud.sqlFishingTracks.password,
    database: config.gcloud.sqlFishingTracks.db,
    host: `/cloudsql/${config.gcloud.sqlFishingTracks.instance}`,
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
