function sanitizeSQL(sql) {
  return sql
    .replace(/%27/g, '\'')
}

module.exports = {
  sanitizeSQL
}
