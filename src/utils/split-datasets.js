function splitDatasets(datasetsFromQuery) {
  return datasetsFromQuery
    .split(',')
    .map(d => (d.indexOf(':') === -1 ? `${d}:latest` : d));
}

module.exports = {
  splitDatasets
}
