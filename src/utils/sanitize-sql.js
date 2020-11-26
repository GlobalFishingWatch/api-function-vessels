const sanitizeSqlQuery = query => {
  /*eslint-disable */
  return query
    .replace(/[*\+\-=~><\"\?^\${}\(\)\:\!\/[\]\\\s]/g, '\\$&')
    .replace(/\|\|/g, '\\||') // replace ||
    .replace(/\&\&/g, '\\&&')
    .replace(/AND/g, '\\A\\N\\D')
    .replace(/OR/g, '\\O\\R')
    .replace(/NOT/g, '\\N\\O\\T');
  /* eslint-enable */
};

module.exports = {
  sanitizeSqlQuery
}
