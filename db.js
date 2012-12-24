/**
 * New node file
 */
var sqlite3 = require('sqlite3').verbose();
var fsys = require('fs');
var util = require('util');

var db ;
var serverStart;
////////////////////////////////////////////////////////////////////////////////

function createDb (bTableBuild) {
    if(bTableBuild) {
        db = new sqlite3.Database('./chatServer.sqlite3', createTables);
    } else {
        db = new sqlite3.Database('./chatServer.sqlite3', createTables);
    }
}

function createTables () { 
    createTableUserInfo ();
}

function createTableUserInfo () {
    // 별명, 이름, 비번, 연락처
    db.run("CREATE TABLE IF NOT EXISTS UserInfo \
    (userid VARCHAR(30), nick VARCHAR(100), passwd VARCHAR(20), PRIMARY KEY(userid) )",
    
    createTableFriendList );
}

function createTableFriendList () {
    db.run("CREATE TABLE IF NOT EXISTS FriendList (userid VARCHAR(30), friendid VARCHAR(30), PRIMARY KEY(userid,friendid))",
        tableCreted ); 
}

function tableCreted () {
    util.debug("createDb Done!!");
    serverStart();
}

exports.authUser = function(userid,passwd, cb) {
    util.debug('authUser invoked...');
    // test select
    var sqlStr = "SELECT count(1) user_exists FROM UserInfo WHERE userid=? AND passwd=?";
    util.debug("authUser/sqlStr:"+sqlStr);

    db.get(sqlStr,userid,passwd, function(err, row) {
        console.log('err: ' + err);
        console.log('row.user_exists: '+ row.user_exists);
        cb (err, row.user_exists);
    });
}

exports.checkUserId = function(aryData, cb) {
    var userid = aryData[0];
    util.debug('checkUserId invoked...');
    var sqlStr = "SELECT count(1) userExists FROM UserInfo WHERE userid=?";
    //util.debug("checkUserId/sqlStr:"+sqlStr);

    db.get(sqlStr,userid, function(err, row) {
        console.log('err: ' + err);
        console.log('row.userExists: '+ row.userExists);
        cb (err, row.userExists);
    });
}

exports.registerUser = function(aryData, cb) {
    //"userid|passwd|nick"
    var userid = aryData[0];
    var passwd = aryData[1];
    var nick   = aryData[2];
    
    util.debug("userid: " + userid);
    util.debug("nick  : " + nick);
    util.debug("passwd: " + passwd);

    db.run("INSERT INTO UserInfo VALUES (?,?,?)", userid, nick, passwd, cb);
}

exports.validateFriendId  = function (friendid, cb) {
    util.debug('validateFriendId invoked...');
    var sqlStr = "SELECT count(1) cnt, nick  FROM UserInfo WHERE userid==?";

    db.get(sqlStr,friendid, function(err, row) {
        util.debug('err: ' + err);
        util.debug('row.cnt: '+ row.cnt);
        util.debug('row.nick: '+ row.nick);
        cb (err, row.cnt, row.nick);
    });
}

exports.removeFriendId = function(userid, friendid, cb) {
    db.run("DELETE FROM FriendList WHERE userid=? AND friendid=?", userid, friendid,  cb);
}

exports.addMyFriend = function (userid, friendid, cb) {
    db.run("INSERT INTO FriendList(userid,friendid) VALUES (?,?)", userid, friendid,  cb);
}

exports.getMyFriendCount = function(userid, cb) {
    util.debug('getMyFriendCount invoked...');
    var sqlStr = "SELECT count(friendid) totalCnt FROM FriendList WHERE userid==?";
    util.debug("getMyFriendCount/sqlStr:"+sqlStr);

    db.get(sqlStr,userid, function(err, row) {
        console.log('err: ' + err);
        console.log('row.totalCnt: '+ row.totalCnt);
        cb (err, row.totalCnt);
    });

}

exports.getMyFriendList = function (userid, cb, totalCnt) {
    util.debug('getMyFriendList invoked...');
    // test select
    //SELECT a.friendid, b.nick FROM FriendList A,userinfo B WHERE A.userid='kojh' and B.userid = a.userid
    var sqlStr = "SELECT a.friendid, b.nick FROM FriendList A,userinfo B WHERE A.userid='"+userid+"' and B.userid = A.friendid";
    util.debug("getMyFriendList/sqlStr:"+sqlStr);

    db.all(sqlStr, function(err, rows) {
        console.log('err: ' + err);
        rows.forEach(function (row) {
            console.log(row);
            cb (row, totalCnt);
        });
        //closeDb();
    });
}

exports.checkAndCreateDB = function (cb) {
    serverStart = cb;
    fsys.exists('./chatServer.sqlite3', function (exists) {
        //util.debug(exists ? "db exists!!" : "db not exists");
        if(!exists) {
            util.debug("createDb call...");
            createDb(true);
        }
        else 
        {
          util.debug("1.db exists...");
          createDb(false, serverStart);
          //db = new sqlite3.Database('./chatServer.sqlite3', getDataClient);
          //db = new sqlite3.Database('./chatServer.sqlite3', getMyFriendList); 

        }
    });
}

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


