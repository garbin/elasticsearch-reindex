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
Running the following command to reindex your data:

```
$ elasticsearch-reindex -s http://192.168.1.100/old_index/old_type -d http://10.0.0.1/new_index/new_type -c 8 -b 50
```
