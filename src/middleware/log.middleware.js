const url = require('url');
const log = require('../log');

module.exports = {
  logger() {
    return async (ctx, next) => {
      try {
        const loggingStartTime = new Date();
        await next();
        const latency = (new Date() - loggingStartTime) / 1000;

        const httpRequest = {
          requestMethod: ctx.method,
          requestUrl: url.format({
            protocol: ctx.protocol,
            host: ctx.hostname,
            pathname: ctx.originalUrl,
          }),
          requestSize: ctx.socket.bytesRead,
          status: ctx.status,
          userAgent: ctx.get('user-agent'),
          remoteIp: ctx.ip,
          latency: `${latency}s`,
        };

        log.info(`HTTP ${ctx.method} ${ctx.originalUrl}`, { httpRequest });
      } catch (err) {
        const message = err.message || '(no error message)';
        const stack = err.stack || '(no stack trace)';
        const logMessage = [`uncaught exception ${message}:`, stack].join('\n');
        log.error(logMessage);
        throw err;
      }
    };
  },
};
