'use strict';

const disallowArgs = args => args.length === 0;

exports.STATE_TYPES = {
  i8: disallowArgs,
  i16: disallowArgs,
  i32: disallowArgs,
  i64: disallowArgs
};

exports.SETTINGS_TYPES = {
  notify: disallowArgs,
  data: (args) => {
    if (args.length !== 1)
      return false;

    return typeof args[0] === 'string';
  }
};
