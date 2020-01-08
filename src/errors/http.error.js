// eslint-disable-next-line max-classes-per-file
class HttpException extends Error {
  constructor(code, msg, params = {}) {
    super(msg);
    this.code = code;
    this.msg = msg;
    this.params = params;
  }
}

class BadRequestException extends HttpException {
  constructor(msg) {
    super(400, msg);
  }
}
class InternalServerException extends HttpException {
  constructor(msg) {
    super(500, msg);
  }
}

class UnauthorizedException extends HttpException {
  constructor(msg) {
    super(401, msg);
  }
}

class ForbiddenException extends HttpException {
  constructor(msg) {
    super(403, msg);
  }
}

class NotFoundException extends HttpException {
  constructor(msg) {
    super(404, msg);
  }
}

class UnprocessableEntityException extends HttpException {
  constructor(msg, params) {
    let p = params;
    if (!Array.isArray(p)) {
      p = [params];
    }
    super(422, msg, p);
  }
}

module.exports = {
  HttpException,
  BadRequestException,
  UnprocessableEntityException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerException,
};
