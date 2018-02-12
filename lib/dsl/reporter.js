'use strict';

class Reporter {
  error(node, message) {
    if (!node || !node.loc || !node.loc.start)
      throw new Error(string + ' at unknown position');

    const start = node.loc.start;
    const err = new Error(string + ` at ${start.line}:${start.column}`);
    err.node = node;
    throw err;
  }
}
module.exports = Reporter;
