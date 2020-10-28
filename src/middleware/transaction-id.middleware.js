const { createNamespace } = require('cls-hooked');
const {
  TRANSACTION_ID: { NAMESPACE, HEADER, PROPERTY },
} = require('../constant');

const koaTransactionId = () => {
  const personalizedRequest = createNamespace(NAMESPACE);
  const middleware = async (ctx, next) => {
    await new Promise(resolve => {
      personalizedRequest.run(async () => {
        if (ctx.request.headers[HEADER]) {
          personalizedRequest.set(PROPERTY, ctx.request.headers[HEADER]);
        }
        await next();
        resolve();
      });
    });
  };
  return middleware;
};

module.exports = koaTransactionId;
