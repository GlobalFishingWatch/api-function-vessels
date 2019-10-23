module.exports = async (req, res, next) => {
  try {
    Object.keys(req.params).forEach(key => {
      if (req.query.hasOwnProperty(key)) {
        req.params[key] = req.query[key];
      }
    });
    return next();
  } catch (err) {
    return next(err);
  }
};
