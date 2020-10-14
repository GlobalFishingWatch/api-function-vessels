const { Client } = require('@elastic/elasticsearch')
const config = require('../config');

module.exports = new Client({
  node: config.elasticsearch.server,
});
