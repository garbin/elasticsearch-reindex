elasticsearch-reindex
=====================

A full feature tool for easy reindex your elasticsearch data

Installation
-----------

```
$ npm install -g elasticsearch-reindex
```
elasticsearch-reindex depends on [Node.js](http://nodejs.org/) and [npm](http://npmjs.org/), install them first [Installing Node.js via package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)

Usage
-------

### Quick start
Simply run the following command to reindex your data:
```
$ elasticsearch-reindex -f http://192.168.1.100:9200/old_index/old_type -t http://10.0.0.1:9200/new_index/new_type
```

You can omit {new_index} and {new_type} if new index name and type name same as the old
```
$ elasticsearch-reindex -f http://192.168.1.100:9200/old_index/old_type -t http://10.0.0.1:9200
```

Advanced feature
----------------

### Customer indexer
Some times, you may want to reindex the data by your custom indexer script(eg. reindex the data to multiple index based on the date field). The custom indexer feature can help you out on this situation.

To use this feature, create your own indexer.js
```js
var moment = require('moment');

module.exports = {
  index: function(item, options) {
    return [
      {index:{_index: 'tweets_' + moment(item._source.date).format('YYYYMM'), _type:options.type || item._type, _id: item._id}},
      item._source
    ];
  }
};
```

Simply pass this script's path, it will work.
```
$ elasticsearch-reindex -f http://192.168.1.100:9200/old_index/old_type -t http://10.0.0.1:9200/ indexer.js
```
### Custom query

Add custom query in indexer.js
```js
var moment = require('moment');

module.exports = {
  query:{
    query:{
      term:{
        user: 'Garbin'
      }
    }
  },
  index: function(item, options) {
    return [
      {index:{_index: 'tweets_' + moment(item._source.date).format('YYYYMM'), _type:options.type || item._type, _id: item._id}},
      item._source
    ];
  }
};
```

Then
```
$ elasticsearch-reindex -f http://192.168.1.100:9200/old_index/old_type -t http://10.0.0.1:9200/ indexer.js
```

Only the user Garbin's data will be indexed


Have fun!

## License

elasticsearch-reindex is licensed under the [MIT License](http://opensource.org/licenses/MIT).
