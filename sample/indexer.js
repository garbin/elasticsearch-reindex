var moment = require('moment');

module.exports = {
  sharded: {
    field: 'idate',
    ranges:[
      [null, '2014-07-15'],
      ['2014-07-15', '2014-08-01']
    ]
  },
  query: { match_all:{} },
  index: function(item, options) {
    return [
      {index:{_index: 'listening_' + moment(item._source.cdate).format('YYYYMM'), _type:options.type || item._type, _id: item._id}},
      item._source
    ];
  }
};
