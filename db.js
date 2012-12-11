/**
 * New node file
 */
var sqlite3 = require('sqlite3').verbose();
var fsys = require('fs');

var db ;
var serverCallBack;
////////////////////////////////////////////////////////////////////////////////

function createDb () {
    console.log("createDb chain db: "+db);
    console.log("createDb chain sqlite3: "+sqlite3);
    db = new sqlite3.Database('./chatServer.sqlite3', createTables);
}

function createTables () {
    console.log("createTable called db: "+db ); //undefined ???? cb 존재시 에러!!
    createTableFriendList ();
}

function createTableFriendList () {
    //multiple db table creation
    console.log("createTable FriendList");
    
    db.run("CREATE TABLE IF NOT EXISTS FriendList (info TEXT)", createTableFriendGroup );
    //TypeError: Cannot call method 'run' of undefined FIXME!!
}

function createTableFriendGroup  () {
    //multiple db table creation
    console.log("createTable FriendGroup");
    db.run("CREATE TABLE IF NOT EXISTS FriendGroup (info TEXT)");

    console.log("createDb Done!!");

    //^^ server listen..
    serverCallBack();
}

function readAllRows () {
    console.log('readAllRows invoked...');
    // test select
    db.all("SELECT info FROM FriendList", function(err, rows) {
        console.log('err: ' + err);
        rows.forEach(function (row) {
            console.log(row.info);
        });
        closeDb();
    });
}

function CheckAndCreateDB (cb) {
    serverCallBack = cb;
    fsys.exists('./chatServer.sqlite3', function (exists) {
        //util.debug(exists ? "db exists!!" : "db not exists");
        if(!exists) {
            console.log("createDb call...");
            createDb();
        }
        else 
        {
          console.log("1.db exists...");
          //db = new sqlite3.Database('./chatServer.sqlite3', getDataClient);
          //db = new sqlite3.Database('./chatServer.sqlite3', readAllRows); 

          cb ();
        }
    });
}

exports.CheckAndCreateDB = CheckAndCreateDB ;
/*
function getDataTest (err) {
    console.log("getDataTest...err: "+ err);
    if(err) {
      console.log('error!!');
      return;
    }
    
    //test insert
    console.log("insertRows FriendList");
    var stmt = db.prepare("INSERT INTO FriendList VALUES (?)");

    for (var i = 0; i < 10; i++) {
        stmt.run("FriendList " + i);
    }

    stmt.finalize(readAllRows);
    
}
function insertRows() {
    console.log("insertRows Ipsum i");
    var stmt = db.prepare("INSERT INTO lorem VALUES (?)");

    for (var i = 0; i < 10; i++) {
        stmt.run("Ipsum " + i);
    }

    stmt.finalize(readAllRows);
}

function readAllRows() {
    console.log("readAllRows lorem");
    db.all("SELECT rowid AS id, info FROM lorem", function(err, rows) {
        rows.forEach(function (row) {
            console.log(row.id + ": " + row.info);
        });
        closeDb();
    });
}
*/
function closeDb  () {
    console.log("closeDb");
    db.close();
}

/*
var db = new sqlite3.Database(':memory:');

db.serialize(function() {
  db.run("CREATE TABLE lorem (info TEXT)");

  var stmt = db.prepare("INSERT INTO lorem VALUES (?)");
  for (var i = 0; i < 10; i++) {
      stmt.run("Ipsum " + i);
  }
  stmt.finalize();

  db.each("SELECT rowid AS id, info FROM lorem", function(err, row) {
      console.log(row.id + ": " + row.info);
  });
});

db.close();

////////////////////////////////////////////////////////////////////////////////


*/


