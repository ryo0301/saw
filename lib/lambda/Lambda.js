'use strict';

module.exports = class Lambda {
  constructor() {
    this.startedAt = 0;
    this.finished = false;
    this.output = [];

    this.handlerPath = process.env.AWS_LAMBDA_HANDLER_PATH;
    this.handlerString = process.env.AWS_LAMBDA_HANDLER_STRING;
    this.payloadBody = process.env.AWS_LAMBDA_PAYLOAD_BODY || "{}";
    this.timeout = (process.env.AWS_LAMBDA_TIMEOUT || 0) * 1000;

    this.baseContext = {
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      memoryLimitInMB: process.env.AWS_LAMBDA_MEMORY_LIMIT,
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      invokedFunctionArn: process.env.AWS_LAMBDA_FUNCTION_ARN,
      invokeid: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
      awsRequestId: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
      logGroupName: `/aws/lambda/${process.env.AWS_LAMBDA_FUNCTION_NAME}`
    };

    process.on('loadLambdaHandler', () => {
      const today = new Date();
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      const d = ('00' + today.getDate()).slice(-2);
      const v = this.baseContext.functionVersion;
      const r = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      this.baseContext.logStreamName = `${y}/${m}/${d}/[${v}]${r}`;

      this.startedAt = Date.now();
      this.baseContext.getRemainingTimeInMillis = () => {
        return this.timeout - (Date.now() - this.startedAt);
      };
    });
    process.on('finishLambdaHandler', () => {
      if (this.startedAt != 0) {
        const elapsedTime = Date.now() - this.startedAt;
        const msg = `[INFO]  elapsed time: ${elapsedTime} / ${this.timeout} ms`;
        this.output.push(msg);
      }
      const usage = process.memoryUsage().rss / 1024 / 1024;
      const limit = this.baseContext.memoryLimitInMB;
      const msg = `[INFO]  memory usage: ${usage.toFixed(2)} / ${limit} MB`;
      this.output.push(msg);
    });
    process.on('uncaughtException', (err) => this.abort(err));
    process.once('beforeExit', () => this.cleanup());
    process.once('exit', () => this.report());
  }

  start() {
    process.emit('loadLambdaHandler');
    const handler = this._getHandler();
    const event = JSON.parse(this.payloadBody);
    invoke(handler, event, this.baseContext, this.finish.bind(this));
  }

  finish(err, data, waitToFinish) {
    this.finished = true;
    if (err == null) {
      let out = data;
      if (typeof out == 'object') {
        out = JSON.stringify(data, null, 2);
      }
      this.output.push(`[INFO]  Result:Success: ${out}`);
    } else {
      this.output.push(`[ERROR] Result:Error: ${err}`);
    }
    if (waitToFinish) {
      return;
    }
    console.info('[INFO]  process exit immediately');
    process.exit(0);
  }

  abort(err) {
    process.emit('finishLambdaHandler');
    console.error('[ERROR] uncaught exception');
    this.output.push(`[ERROR] ${err.stack}`);
    process.exit(1);
  }

  cleanup() {
    process.emit('finishLambdaHandler');
    if (!this.finished) {
      this.output.push('[WARN] callback or context.done has not been called.');
    }
  }

  report() {
    console.log(this.output.join('\n'));
  }

  _getHandler() {
    const appParts = this.handlerString.split('.');
    const handlerName = appParts[1];
    const app = require(this.handlerPath);
    const userHandler = app[handlerName];
    return userHandler;
  }
};

function invoke(handler, event, baseContext, finish) {
  let waitToFinish = true;
  let consumed = false;

  const callback = (err, data) => {
    if (consumed) {
      return;
    }
    consumed = true;
    finish(err, data, waitToFinish);
  };

  const context = Object.assign({
    set callbackWaitsForEmptyEventLoop(value) {
      waitToFinish = value;
    },
    get callbackWaitsForEmptyEventLoop() {
      return waitToFinish;
    },
    done: (err, data) => {
      waitToFinish = false;
      callback(err, data);
    },
    succeed: (data) => {
      context.done(null, data);
    },
    fail: (err) => {
      context.done(err, null);
    }
  }, baseContext);

  handler(event, context, callback);
}
