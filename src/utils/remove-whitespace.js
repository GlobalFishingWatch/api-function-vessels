const removeWhitespace = str => {
  return str
    .replace(/%27/g, '\'')
}

module.exports = {
  removeWhitespace
}
