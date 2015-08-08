module.exports = function escapeRegExp (reStr) {
  'use strict';
  return reStr.toString().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};
