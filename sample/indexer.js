var moment = require('moment');

module.exports = {
  // interval: months, weeks, days
  sharded: { field: 'idate', interval:'5', start:'2014-09-01', end:'2014-10-01'},
//  query: { match_all:{} },
  index: function(item, options) {
    return [
      {index:{_index: 'listening_' + moment(item._source.cdate).format('YYYYMM'), _type:options.type || item._type, _id: item._id}},
      item._source
    ];
  }
};
