var moment = require('moment');

module.exports = {
  query: { match_all:{} },
  index: function(item, options) {
    return [
      {index:{_index: 'listening_' + moment(item._source.cdate).format('YYYYMM'), _type:options.type || item._type, _id: item._id}},
      item._source
    ];
  }
};
