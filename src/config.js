const greenpeace = require('./greenpeace');

const environments = {
  development: {
    inherits: ['all'],
  },

  test: {
    inherits: ['development', 'all'],
  },

  production: {
    inherits: ['all'],
  },
};

module.exports = greenpeace.sanitizeEnvironment(environments, {
  log: {
    level: greenpeace.entry({
      key: 'LOG_LEVEL',
      doc:
        'Logging level. In increasing amount of logs: error, warn, info, verbose, debug, silly',
      defaults: { all: 'debug' },
      required: true,
    }),
  },

  redis: {
    enabled: greenpeace.entry({
      key: 'REDIS_ENABLED',
      doc: 'True if cache (Redis) is enabled, false in other case',
      defaults: { test: true },
      required: true,
    }),
    host: greenpeace.entry({
      key: 'REDIS_HOST',
      doc: 'Redis host to connect to',
      defaults: { test: 'dummy' },
      required: false,
    }),
    port: greenpeace.entry({
      key: 'REDIS_port',
      doc: 'Redis port connect to. Default 6379',
      defaults: { test: 6379 },
      required: false,
    }),
  },
  auth: {
    username: greenpeace.entry({
      key: 'AUTH_USERNAME',
      doc: 'Username for flush cache endpoint',
      defaults: { test: 'gfw' },
      required: true,
    }),
    password: greenpeace.entry({
      key: 'AUTH_PASSWORD',
      doc: 'Password for flush cache endpoint',
      defaults: { test: 'admin' },
      required: true,
    }),
  },

  platform: {
    settingsServer: greenpeace.entry({
      key: 'PLATFORM_SETTINGS_SERVER',
      doc: 'Protocol, host and port of the settings API',
      defaults: {
        development: 'https://settings.api.dev.globalfishingwatch.org',
      },
      required: true,
    }),
  },

  gcloud: {
    sql: {
      user: greenpeace.entry({
        key: 'GCLOUD_SQL_USER',
        doc: 'Google Cloud SQL username',
        defaults: { test: 'dummy' },
        required: true,
      }),
      password: greenpeace.entry({
        key: 'GCLOUD_SQL_PASSWORD',
        doc: 'Google Cloud SQL password',
        defaults: { test: 'dummy' },
        required: true,
      }),
      db: greenpeace.entry({
        key: 'GCLOUD_SQL_DB',
        doc: 'Google Cloud SQL database to connect to',
        defaults: { test: 'dummy' },
        required: true,
      }),
      instance: greenpeace.entry({
        key: 'GCLOUD_SQL_INSTANCE',
        doc: 'Google Cloud SQL instance to connect to',
        defaults: { test: 'dummy' },
        required: true,
      }),
    },
  },
});
