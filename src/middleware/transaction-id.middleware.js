const { createNamespace } = require('cls-hooked');
const { TRANSACTION_ID: { NAMESPACE, HEADER, PROPERTY} } = require('../constant');

const koaTransactionId = function () {
  const personalizedRequest = createNamespace(NAMESPACE);
  const middleware = (ctx, next) => {
    personalizedRequest.run(() => {
      if (ctx.request.headers[HEADER]) {
        personalizedRequest.set(PROPERTY, ctx.request.headers[HEADER]);
      }
      next();
    })
  };
  return middleware;
};


module.exports = koaTransactionId;
