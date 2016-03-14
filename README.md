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

If you're using the Amazon Elasticsearch Service you can provide your access and secret keys and region.

```
$ elasticsearch-reindex -f http://123.es.amazonaws.com -t http://10.0.0.1:9200 --region us-east-1 --access_key ABC --secret_key 123
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

### Index parallelly

Will take a very very long time to reindex a very big index, you may want to make it small, and reindex it parallelly. Now you can do this with the "Shard" feature.

```js
var moment = require('moment');

module.exports = {
  sharded:{
    field: "created_at",
    start: "2014-01-01",
    end:   "2014-12-31",
    interval: 'month' // day, week, or a number of day, such as 7 for 7 days.
  },
  index: function(item, options) {
    return [
      {index:{_index: 'tweets_' + moment(item._source.date).format('YYYYMM'), _type:options.type || item._type, _id: item._id}},
      item._source
    ];
  }
};
```

The sharded config will make the big index into 12 shards based on created_at field and reindex it parallelly.

Then
```
$ elasticsearch-reindex -f http://192.168.1.100:9200/old_index/old_type -t http://10.0.0.1:9200/ indexer.js
```

### Index with promises

Added support for promises so that you can request data from other parts of the database

```js
module.exports = {
  index: function (item, opts, client) {
    var indexData = {
          index: {
            _index: opts.index,
            _type: item._type,
            _id: item._id
          }
        };
    
    // With the client we can access other parts of our database
    return client.mget({
      index: 'media',
      type: 'movies',
      body: {
        ids: item._source.favoriteMovieIDs
      }
    }).then(function (response) {
      item._source.faveMovies = response.docs.map(function (movie) {
        return {
          name: movie._source.name,
          id: movie._source.id
        };      
      });
      
      return [indexData, item._source];
    });
  }
}
```

Then
```
$ elasticsearch-reindex -f http://192.168.1.100:9200/old_index/old_type -t http://10.0.0.1:9200/ -m true indexer.js
```

You will see the reindex progress for every shard clearly

Have fun!

## License

elasticsearch-reindex is licensed under the [MIT License](http://opensource.org/licenses/MIT).
