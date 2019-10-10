const swaggerError2ValidationError = errors => ({
  fields: errors.map(error => ({
    field: error.param,
    errors: [
      {
        code: 422,
        message: `${error.msg}${error.value ? `: ${error.value}` : ''}`,
      },
    ],
  })),

  general: [],
});

module.exports = {
  handleErrors() {
    return (err, req, res, next) => {
      if (res.headersSent) {
        return next(err);
      }

      if (err.validation) {
        return res
          .status(400)
          .json(swaggerError2ValidationError(err.validation));
      }

      return res.sendStatus(500);
    };
  },
};
