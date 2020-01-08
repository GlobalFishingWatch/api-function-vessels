const helmet = require('helmet');
const { promisify } = require('util');

const koaHelmet = function(...args) {
  const helmetPromise = promisify(helmet(...args));

  const middleware = (ctx, next) => {
    ctx.req.secure = ctx.request.secure;
    return helmetPromise(ctx.req, ctx.res).then(next);
  };
  return middleware;
};

Object.keys(helmet).forEach(function(helmetMethod) {
  koaHelmet[helmetMethod] = function(...args) {
    const method = helmet[helmetMethod];
    const methodPromise = promisify(method(...args));

    return (ctx, next) => {
      ctx.req.secure = ctx.request.secure;
      return methodPromise(ctx.req, ctx.res).then(next);
    };
  };
});

module.exports = koaHelmet;
