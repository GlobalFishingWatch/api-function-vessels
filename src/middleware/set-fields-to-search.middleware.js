const { log } = require('gfw-api-utils').logger;

module.exports = async (ctx, next) => {
  let fields = [];
  ctx.state.datasets.forEach(dataset => {
    fields = fields.concat(dataset.fieldsAllowed);
  })
  ctx.state.fieldsToSearch = [...new Set(fields)];
  log.info(`Fields allowed to seach ${ctx.state.fieldsToSearch}`);
  await next();
};
