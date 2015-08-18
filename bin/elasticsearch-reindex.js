#!/usr/bin/env node

var cli           = require('commander'),
    elasticsearch = require('elasticsearch'),
    cluster       = require('cluster'),
    moment        = require('moment'),
    _             = require('underscore'),
    bunyan        = require('bunyan'),
    ProgressBar   = require('progress'),
    fs            = require('fs'),
    Indexer       = require('../lib/indexer'),
    escapeRegExp  = require('../lib/escape-regexp'),
    URI           = require('URIjs');


cli
.version('1.1.10')
.option('-f, --from [value]', 'source index, eg. http://192.168.1.100:9200/old_index/old_type')
.option('-t, --to [value]', 'to index, eg. http://192.168.1.100:9200/new_index/new_type')
.option('-c, --concurrency [value]', 'concurrency for reindex', require('os').cpus().length)
.option('-b, --bulk [value]', 'bulk size for a thread', 100)
.option('-q, --query_size [value]', 'query size for scroll', 100)
.option('-s, --scroll [value]', 'default 1m', '1m')
.option('-o, --request_timeout [value]', 'default 60000', 60000)
.option('-l, --log_path [value]', 'default ./reindex.log', './reindex.log')
.option('-r, --trace', 'default false', false)
.option('-n, --max_docs [value]', 'default -1 unlimited', -1)
.option('-v, --api_ver [value]', 'default 1.5', '1.5')
.option('-p, --parent [value]', 'if set, uses this field as parent field', '')
.option('-m, --promise [value]', 'if set indexes expecting promises, default: false', false)
.option('-z, --compress [value]', 'if set, requests compression of data in transit', false)
.parse(process.argv);

var logger        = bunyan.createLogger({
  src: true,
  name: "elasticsearch-reindex",
  streams: [{
    path: cli.log_path
  }]
});

var custom_indexer = cli.args[0] ? require(fs.realpathSync(cli.args[0])) : null;

if (cluster.isMaster) {
  if (custom_indexer && custom_indexer.sharded) {
    var ranges = [];
    if (custom_indexer.sharded.ranges) {
      ranges = custom_indexer.sharded.ranges;
    } else {
      var now = moment();
      var start = moment(custom_indexer.sharded.start);
      var end = custom_indexer.sharded.end ? moment(custom_indexer.sharded.end) : now;
      var current = start;
      var interval_days = 1;
      switch(custom_indexer.sharded.interval) {
        case 'month':
          interval_days = 30;
          break;
        case 'week':
          interval_days = 7;
          break;
        default:
          interval_days = parseInt(custom_indexer.sharded.interval);
      }
      while(current < end){
        var current_end = current.clone().add(interval_days, 'days');
        if (current_end > end) {
          current_end = end;
        }
        ranges.push({
          name: current.format('YYMMDD') + '-' + current_end.format('YYMMDD'),
          range: {
            gte: current.format('YYYY-MM-DD'),
            lt: current_end.format('YYYY-MM-DD')
          }
        });
        current = current_end;
      }
    }
    ranges.forEach(function(shard) {
      var worker_arg = {range:{}, name: shard.name};
      worker_arg.range[custom_indexer.sharded.field] = shard.range;
      cluster.fork({worker_arg:JSON.stringify(worker_arg)});
    });
  } else {
    cluster.fork();
  }
  cluster.on('exit', function(worker, code, signal) {
    if( signal ) {
      logger.fatal("worker was killed by signal: "+signal);
      console.log("worker was killed by signal: "+signal);
    } else if( code !== 0 ) {
      logger.fatal("worker exited with error code: "+code);
      console.log("worker exited with error code: "+code);
    } else {
      console.log('    Worker finished its work!');
    }
  });
} else {
  var worker_arg = null;
  var range = null;
  var shard_name = '';

  if (process.env.worker_arg) {
    worker_arg = JSON.parse(process.env.worker_arg);
    range = worker_arg.range;
    shard_name = worker_arg.name;
  }

  var from_uri      = new URI(cli.from),
      to_uri        = new URI(cli.to),
      from_host     = cli.from.replace(new RegExp(escapeRegExp(from_uri.path()) + '.*'), ''),
      to_host       = cli.to.replace(new RegExp(escapeRegExp(to_uri.path()) + '.*'), '');

  // If no path was supplied, URIjs will always return '/' from `MyURI.path()`
  // We should strip the trailing slash if present and provide the rest of
  // the host string to the client.
  if (from_uri.path() === '/') {
    from_host = cli.from.replace(/\/$/, '');
  }
  if (to_uri.path() === '/') {
    to_host = cli.to.replace(/\/$/, '');
  }

  var from_client   = new elasticsearch.Client({ host: from_host, requestTimeout: cli.request_timeout, apiVersion: cli.api_ver, suggestCompression: cli.compress }),
      to_client     = new elasticsearch.Client({ host: to_host, requestTimeout: cli.request_timeout, apiVersion: cli.api_ver, suggestCompression: cli.compress }),
      from_path     = (function() { var tmp = from_uri.path().split('/'); return { index:tmp[1], type:tmp[2]}; })(),
      to_path       = (function() { var tmp = to_uri.path().split('/'); return { index:tmp[1], type:tmp[2]}; })(),
      processed_total        = 0,
      processed_failed       = 0;
  var scan_options = {
        index       : from_path.index,
        type        : from_path.type,
        search_type : 'scan',
        scroll      : cli.scroll,
        size        : cli.query_size,
        body        : {}
      };

  if (range) {
    _.defaults(scan_options.body, {query:{range:range}});
  }

  if (custom_indexer && custom_indexer.query) {
    scan_options.body = _.extend(scan_options.body, custom_indexer.query);
  }

  var reindexer = new Indexer();
  var bar = new ProgressBar("    " + shard_name + " reindexing [:bar] :current/:total(:percent) :elapsed :etas", {total:100, width:30});

  reindexer.on('item-failed', function(item) {
    processed_failed++;
    logger.warn(item);
  });

  reindexer.on('error', function(error) {
    logger.error(error);
  });

  reindexer.on('batch-complete', function(num_of_success) {
    console.log("\n");
    bar.tick(num_of_success);
  });

  from_client.search(scan_options, function scroll_fetch(err, res) {
    if (err) {
      logger.fatal(err);
      return console.log("Scroll error:" + err);
    }
    if (!res.hits.total) {
      logger.info('No documents can be found!');
      console.log('No documents can be found!');
      return process.exit();
    }
    bar.total = cli.max_docs === -1 ? res.hits.total : (cli.max_docs > res.hits.total ? res.hits.total : cli.max_docs);
    var docs = res.hits.hits,
      reindexMethod = cli.promise ? 'indexPromise' : 'index';

    processed_total = processed_total + docs.length;
    if (processed_total > bar.total) {
      docs = docs.slice(0, bar.total - processed_total);
      processed_total = bar.total;
    }
    reindexer[reindexMethod](docs, {
      concurrency : cli.concurrency,
      bulk        : cli.bulk,
      client      : to_client,
      indexer     : custom_indexer ? custom_indexer.index : null,
      index       : to_path.index,
      type        : to_path.type,
      parent      : cli.parent
    }, function(err) {
      if (err) {
        logger.fatal(err);
        return console.log("Reindex error: " + err);
      }
      if (processed_total < bar.total) {
        from_client.scroll({
          body : res._scroll_id,
          scroll : cli.scroll
        }, scroll_fetch);
      } else {
        var msg = "    " + shard_name + " Total " + processed_total + " documents have been processed!";
        if (processed_failed) {
          msg +=   " about " + processed_failed + " documents reindex failed, see the " + cli.log_path;
        }
        console.log("\n" + msg);
        logger.info(msg);
        process.exit();
      }
    });
  });
}
