'use strict';

var Slouch = require('../../scripts'),
  utils = require('../utils'),
  Promise = require('sporks/scripts/promise');

describe('partition', function () {
  var slouch = null,
    db = null,
    system = null,
    defaultGet = null,
    partition = null;

  beforeEach(function () {
    slouch = new Slouch(utils.couchDBURL());
    db = slouch.db;
    system = slouch.system;
    return utils.createDB(true).then(function () {
      return;
    });
  });

  afterEach(function () {
    system.get = defaultGet;
    return utils.destroyDB();
  });

  var fakePartitionedSupport = function () {
    defaultGet = system.get;
    system.get = function () {
      return Promise.resolve({
        features: ['partitioned']
      });
    };
  };

  var createDocs = function () {
    return slouch.doc.create(utils.createdDB, {
      _id: 'part:1',
      thing: 'jam'
    }).then(function () {
      return slouch.doc.create(utils.createdDB, {
        _id: 'part:2',
        thing: 'code',
        fun: false
      });
    }).then(function () {
      return slouch.doc.create(utils.createdDB, {
        _id: 'partX:3',
        thing: 'jam'
      });
    }).then(function () {
      return slouch.doc.create(utils.createdDB, {
        _id: 'partX:4',
        thing: 'slouch',
        fun: false
      });
    });
  };

  var createView = function () {
    return slouch.doc.create(utils.createdDB, {
      _id: '_design/myview',
      views: {
        fun: {
          map: [
            'function(doc) {',
            'if (doc.fun !== false) {',
            'emit(doc._id, null);',
            '}',
            '}'
          ].join(' ')
        }
      }
    });
  };

  it('should check if support partitioned', function () {
    // We run the tests on both CouchDB 1 and 2+ and so we don't care about the version. In the
    // future, we could pass a parameter to our test script that would allow us to test this better.
    return system.supportPartitioned().then(function (p) {
      partition = p;
    });
  });

  it('should detect partitioned support', function () {
    fakePartitionedSupport();
    return system.supportPartitioned().then(function (p) {
      p.should.eql(true);
    });
  });

  it('should cache partitioned support', function () {
    fakePartitionedSupport();
    return system.supportPartitioned().then(function () {
      return system.supportPartitioned();
    }).then(function (p) {
      p.should.eql(true);
    });
  });

  it('should create partitioned database', function () {
    return db.isPartitioned(utils.createdDB).then(function (p) {
      p.should.eql(partition);
    });
  });

  it('should get partitioned db', function () {
    return createDocs().then(function () {
      return db.getPartition(utils.createdDB, 'part').then(
        function (_db) {
          _db.db_name.should.eql(utils.createdDB);
          _db.partition.should.eql('part');
          _db.doc_count.should.eql(2);
        });
    });
  });

  it('should get all docs as Array in partitioned db', function () {
    return createDocs().then(function () {
      return slouch.doc.allPartitionArray(utils.createdDB, 'part').then(function (
        body) {
        body.total_rows.should.eql(2);
      });
    });
  });

  it('should get all docs in partitioned db', function () {
    var docs = {};
    return createDocs().then(function () {
      return slouch.doc.allPartition(utils.createdDB, 'part').each(function (item) {
        docs[item.id] = true;
        return Promise.resolve();
      }).then(function () {
        docs.should.eql({
          'part:1': true,
          'part:2': true
        });
      });
    });
  });

  it('should get view in partitioned db', function () {
    var docs = {};
    return createDocs().then(function () {
      return createView();
    }).then(function () {
      return db.viewPartition(utils.createdDB, 'part', '_design/myview', 'fun', {
        include_docs: true
      }).each(function (doc) {
        // Use associative array as order is not guaranteed
        docs[doc.doc._id] = true;
      });
    }).then(function () {
      docs.should.eql({
        'part:1': true
      });
    });
  });

  it('should get view array in partitioned db', function () {
    var docs = {};
    return createDocs().then(function () {
      return createView();
    }).then(function () {
      return db.viewPartitionArray(utils.createdDB, 'part', '_design/myview', 'fun', {
        include_docs: true
      }).then(function (_docs) {
        _docs.rows.forEach(function (_doc) {
          // Use associative array as order is not guaranteed
          docs[_doc.doc._id] = true;
        });
      });
    }).then(function () {
      docs.should.eql({
        'part:1': true
      });
    });
  });

  it('should find doc in partitioned db', function () {
    return createDocs().then(function () {
      return slouch.doc.findPartition(utils.createdDB, 'part', {
        selector: {
          thing: 'jam'
        }
      }).then(function (items) {
        items.docs.length.should.eql(1);
        items.docs[0]._id.should.eql('part:1');
      });
    });
  });
});
