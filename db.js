/**
 * 20131015
 */
var sqlite3 = require('sqlite3').verbose();
var fsys = require('fs');
var util = require('util');
const debuglog = util.debuglog('db'); 

var db ;
var serverStart;
////////////////////////////////////////////////////////////////////////////////

function createDb () {
    db = new sqlite3.Database('./chatServer.sqlite3', createTables);
}

////////////////////////////////////////////////////////////////////////////////
function createTables () { 
    createTableUserInfo ();
}

////////////////////////////////////////////////////////////////////////////////
function createTableUserInfo () {
    // 별명, 이름, 비번, 연락처
    db.run("CREATE TABLE IF NOT EXISTS UserInfo \
    (userid VARCHAR(30), nick VARCHAR(100), passwd VARCHAR(20), PRIMARY KEY(userid) )",
    
    createTableFriendList );
}

////////////////////////////////////////////////////////////////////////////////
function createTableFriendList () {
    db.run("CREATE TABLE IF NOT EXISTS FriendList (userid VARCHAR(30), friendid VARCHAR(30), PRIMARY KEY(userid,friendid))",
        tableCreted ); 
}

////////////////////////////////////////////////////////////////////////////////
function tableCreted () {
    debuglog("createDb Done!!");
    serverStart();
}

////////////////////////////////////////////////////////////////////////////////
exports.authUser = function(userid,passwd, cb) {
    debuglog('authUser invoked...');
    // test select
    var sqlStr = "SELECT count(1) user_exists, nick FROM UserInfo WHERE userid=? AND passwd=?";
    debuglog("authUser/sqlStr:"+sqlStr)
    db.get(sqlStr,userid,passwd, function(err, row) {
        console.log('err: ' + err);
        console.log('row.user_exists: '+ row.user_exists);
        cb (err, row.user_exists, row.nick);
    });
}

////////////////////////////////////////////////////////////////////////////////
exports.checkUserId = function(aryData, cb) {
    var userid = aryData[0];
    debuglog('checkUserId invoked...');
    var sqlStr = "SELECT count(1) userExists FROM UserInfo WHERE userid=?";
    //debuglog("checkUserId/sqlStr:"+sqlStr);

    db.get(sqlStr,userid, function(err, row) {
        console.log('err: ' + err);
        console.log('row.userExists: '+ row.userExists);
        cb (err, row.userExists);
    });
}

////////////////////////////////////////////////////////////////////////////////
exports.registerUser = function(aryData, cb) {
    //"userid|passwd|nick"
    var userid = aryData[0];
    var passwd = aryData[1];
    var nick   = aryData[2];
    
    debuglog("userid: " + userid);
    debuglog("nick  : " + nick);
    debuglog("passwd: " + passwd);

    db.run("INSERT INTO UserInfo VALUES (?,?,?)", userid, nick, passwd, cb);
}

////////////////////////////////////////////////////////////////////////////////
exports.validateFriendId  = function (friendid, cb) {
    debuglog('validateFriendId invoked...');
    var sqlStr = "SELECT count(1) cnt, nick  FROM UserInfo WHERE userid==?";

    db.get(sqlStr,friendid, function(err, row) {
        debuglog('err: ' + err);
        debuglog('row.cnt: '+ row.cnt);
        debuglog('row.nick: '+ row.nick);
        cb (err, row.cnt, row.nick);
    });
}

////////////////////////////////////////////////////////////////////////////////
exports.removeFriendId = function(userid, friendid, cb) {
    db.run("DELETE FROM FriendList WHERE userid=? AND friendid=?", userid, friendid,  cb);
}

////////////////////////////////////////////////////////////////////////////////
exports.addMyFriend = function (userid, friendid, cb) {
    db.run("INSERT INTO FriendList(userid,friendid) VALUES (?,?)", userid, friendid,  cb);
}

////////////////////////////////////////////////////////////////////////////////
exports.getMyFriendCount = function(userid, cb) {
    debuglog('getMyFriendCount invoked...');
    var sqlStr = "SELECT count(friendid) totalCnt FROM FriendList WHERE userid==?";
    debuglog("getMyFriendCount/sqlStr:"+sqlStr);

    db.get(sqlStr,userid, function(err, row) {
        console.log('err: ' + err);
        console.log('row.totalCnt: '+ row.totalCnt);
        cb (err, row.totalCnt);
    });
}

////////////////////////////////////////////////////////////////////////////////
exports.getMyFriendList = function (userid, cb, totalCnt) {
    debuglog('getMyFriendList invoked...');
    var sqlStr = "SELECT a.friendid, b.nick FROM FriendList A,userinfo B WHERE A.userid='"+userid+"' and B.userid = A.friendid";
    debuglog("getMyFriendList/sqlStr:"+sqlStr);

    db.all(sqlStr, function(err, rows) {
        console.log('err: ' + err);
        rows.forEach(function (row) {
            console.log(row);
            cb (row, totalCnt);
        });
        //closeDb();
    });
}

////////////////////////////////////////////////////////////////////////////////
exports.checkAndCreateDB = function (cb) {
    serverStart = cb;
    fsys.exists('./chatServer.sqlite3', function (exists) {
        //debuglog(exists ? "db exists!!" : "db not exists");
        if(!exists) {
            debuglog("createDb call...");
            createDb();
        } else {
          debuglog("1.db exists...");
          db = new sqlite3.Database('./chatServer.sqlite3', serverStart );
        }
    });
}

////////////////////////////////////////////////////////////////////////////////
function closeDb  () {
    console.log("closeDb");
    db.close();
}



