
const parseSqlToElasticSearchQuery = (datasets, where) => {
  return `SELECT * FROM "${datasets}" WHERE ${where}`;
}

module.exports = {
  parseSqlToElasticSearchQuery
}
