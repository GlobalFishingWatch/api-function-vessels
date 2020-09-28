module.exports = type => async (ctx, next) => {
  if (!ctx.state.datasets.every(d => d.type.startsWith(type))) {
    ctx.throw(400, `The dataset should be a ${type}:* type`);
  }
  await next();
};
