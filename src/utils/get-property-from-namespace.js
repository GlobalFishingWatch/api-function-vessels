const { getNamespace } = require('cls-hooked');

const getPropertyFromNamespace = (namespace, property) => {
  const myRequest = getNamespace(namespace);
  return myRequest && myRequest.get(property) ? myRequest.get(property) : undefined;
};

module.exports = {
  getPropertyFromNamespace,
}
