elasticsearch-reindex
=====================

A tool for easy reindex your elasticsearch data

Installation
-----------

```
$ npm install -g elasticsearch-reindex
```

Example
-------

Quick start: run the following command to reindex your data:
```
$ elasticsearch-reindex -s http://192.168.1.100/old_index/old_type -d http://10.0.0.1/new_index/new_type -b 100
```

Use custom indexer:

Create your own indexer.js
```js
var moment = require('moment');

module.exports = {
  index: function(item, options) {
    return [
      {index:{_index: 'listening_' + moment(item._source.date).format('YYYYMM'), _type:options.type || item._type, _id: item._id}},
      item._source
    ];
  }
};
```

Pass the script path to elasticsearch-reindex to reindex your data with it
```
$ elasticsearch-reindex -s http://192.168.1.100/old_index/old_type -d http://10.0.0.1/ -b 100 ./indexer.js
```
