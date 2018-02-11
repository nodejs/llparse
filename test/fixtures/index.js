'use strict';

const fs = require('fs');
const path = require('path');

const file = (name) => {
  return fs.readFileSync(path.join(__dirname, name)).toString();
};

exports.source = {
  example: file('example.js')
};
