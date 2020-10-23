const { getNamespace } = require('cls-hooked');

const getTransactionId = (namespace) => {
  const myRequest = getNamespace(namespace);
  return myRequest && myRequest.get('transactionId') ? myRequest.get('transactionId') : undefined;
};

module.exports = {
  getTransactionId
}
