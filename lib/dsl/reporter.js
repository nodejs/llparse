'use strict';

class Reporter {
  error(node, message) {
    if (!node || !node.loc || !node.loc.start)
      throw new Error(message + ' at unknown position');

    const start = node.loc.start;
    const err = new Error(message + ` at ${start.line}:${start.column}`);
    err.node = node;
    throw err;
  }
}
module.exports = Reporter;
