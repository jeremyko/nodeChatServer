/**
 * 20131015
 * TODO
 * 1. for the first time use, adding friend doesn't get notified to other.
 * 2. for the first time user, logout doesn't get notified to other.
 */
var net = require('net');
//var fsys = require('fs');
var util = require('util');
const debuglog = util.debuglog('main'); 
var chatDb = require('./db');

chatDb.checkAndCreateDB( serverStart );

////////////////////////////////////////////////////////////////////////////////

/**
 * 구현 기능:
 * 1. 최초 사용자 등록하기 (별명, 이름, 비번 ) 
 * 2. 대화상대 추가/삭제 하기  
 * 2. 로그인시 인증 및 사용자 정보(대화목록) 보내주기 
 * 3. 로그인/아웃 여부를 모두에게 알리기 
 * 4. 채팅 메시지 전달하기 
 */
var SERVER_PORT = 8124;
var TCP_DELIMITER = '|';
var PACKET_HEADER_LEN = 4; // 32 bit integer --> 4
//var packetInfoFieldLen = 5+1; //65536| --> string packet

////////////////////////////////////////////////////////////////////////////////
var clientConnectionsByUserID  = {}; //connection only
var clientConnectionsByRemoteIpPort    = {};

function ClientData (conn, userid, nick,ipaddr)
{
    this.connection = conn;
    this.userId=userid;
    this.nick=nick;
    //this.ipAddr=ipaddr;
    this.friendList = []; // id 
}

////////////////////////////////////////////////////////////////////////////////

function broadcastMsg ( me, notiMsg) {
    //대화상대들에게 알림
    debuglog("broadcastMsg:"+me);
    var toNotifyList = clientConnectionsByUserID[me].friendList;
    
    for( var id in toNotifyList) { // for 고려!!
        debuglog("toNotifyList: " + toNotifyList[id]);
        if( clientConnectionsByUserID[ toNotifyList[id] ]) {
            debuglog("notify To: " + toNotifyList[id]);
            sendMsgToClient(clientConnectionsByUserID[ toNotifyList[id] ].connection, notiMsg);    
        }
    }
}

function broadcastLogOut( remoteIpPort) {
    debuglog("broadcastLogOut:"+remoteIpPort);
    var connOfMe = clientConnectionsByRemoteIpPort[remoteIpPort];    
    if(connOfMe) {
        var notiMsg = "LOGGED-OUT|" + connOfMe.userId +TCP_DELIMITER+connOfMe.nick;

        var toNotifyList = connOfMe.friendList;
    
        for( var id in toNotifyList) { // for 고려!!
            if( clientConnectionsByUserID[ toNotifyList[id] ]) {
                debuglog("notify To: " + toNotifyList[id]);
                sendMsgToClient(clientConnectionsByUserID[ toNotifyList[id] ].connection, notiMsg, deleteClient);    
            }else{
                delete clientConnectionsByUserID[connOfMe.userId];
                delete clientConnectionsByRemoteIpPort[remoteIpPort]; 
            }
        }   
    }

    function deleteClient() {
        debuglog("deleteClient");
        delete clientConnectionsByUserID[connOfMe.userId];
        delete clientConnectionsByRemoteIpPort[remoteIpPort]; 
    }
}

////////////////////////////////////////////////////////////////////////////////
var serverFunctions   = {};

function sendMsgToClient(connection, msg, cb) {
    var buffMsg = Buffer.from(msg);
    var msgLen = buffMsg.length ;
    //packet length info
    var bufPacketLenInfo = Buffer.alloc(4);
    bufPacketLenInfo.fill();
    var headerLen= bufPacketLenInfo.length;
    bufPacketLenInfo.writeUInt32BE(msgLen, 0); 
    
    var bufTotal = Buffer.alloc(  headerLen + msgLen ); //packet length info + msg
    bufTotal.fill();
    //console.log('bufTotal.length =%d', bufTotal.length);    
    bufPacketLenInfo.copy(bufTotal, 0, 0, headerLen);
    buffMsg.copy(bufTotal, headerLen, 0, msgLen );
    
    console.log('SEND:['+bufTotal.length+']['+ bufTotal + ']');
    if(cb) {
        connection.write(bufTotal, cb );
    }else{
        connection.write(bufTotal, function () { debuglog("written out!"); });
    }
}

////////////////////////////////////////////////////////////////////////////////
function getErrString(usage, err) {
    var returnStr="";
    if(err) {
        debuglog("err:"+err.toString());
        returnStr = usage + "|FAIL|"+err.toString();
    }else{
        returnStr = usage + "|OK";
    }

    return returnStr;
}
////////////////////////////////////////////////////////////////////////////////

serverFunctions ['CHATMSG'] = function (connection, remoteIpPort, packetData) {
    //var packetDataCopy = packetData;
    console.log('function CHATMSG:'+ packetData);  //userid|friendid|msg
    var aryData = packetData.split(TCP_DELIMITER);   
    //var userid   = aryData[0];
    var friendid = aryData[1];
    //var chatMsg = aryData[2];
    var friendOnline = clientConnectionsByUserID[friendid];
    if(friendOnline != undefined) {
        sendMsgToClient( clientConnectionsByUserID[friendid].connection, 'CHATMSG'+TCP_DELIMITER+packetData);
    } else {
        debuglog('ERR: friendid is NOT ONLINE!'+ friendid);
    }
} ;

////////////////////////////////////////////////////////////////////////////////
serverFunctions ['DELETEFRIEND'] = function (connection, remoteIpPort, packetData) {
    console.log('function DELETEFRIEND:'+ packetData);  //kojh|ddd
    //DELETEFRIEND|userid|friendid
    var aryData = packetData.split(TCP_DELIMITER);   
    var userid   = aryData[0];
    var friendid = aryData[1];
    
    //friendid validation
    chatDb.removeFriendId(userid, friendid, whenFriendRemoveResultComes);

    function whenFriendRemoveResultComes(err) {
        debuglog("whenAddFriendResultComes");
        //DELETEFRIEND|OK|friendid
        //DELETEFRIEND|FAIL|err string
        var returnStr = getErrString( 'DELETEFRIEND', err);
        if(!err) {
            returnStr += TCP_DELIMITER + friendid;
        }

        sendMsgToClient(connection, returnStr);
    }
}  ;

////////////////////////////////////////////////////////////////////////////////
serverFunctions ['CHKID'] = function (connection, remoteIpPort, packetData) {
    debuglog('function CHKID:'+ packetData);
    //"userid"
    var aryData = packetData.split(TCP_DELIMITER);   
    chatDb.checkUserId(aryData, whenCheckIdCompletes);

    function whenCheckIdCompletes(err,userExists) {
        debuglog("whenCheckIdCompletes");
        var returnStr = "";
        if( userExists > 0) { //user already exists!
            returnStr = "CHKID|FAIL|userid already exists!";
        } else {
            returnStr = getErrString( 'CHKID', err);
        }
    
        //send back TODO 
        sendMsgToClient(connection, returnStr);
    }
}  ;

////////////////////////////////////////////////////////////////////////////////
serverFunctions ['REGISTER'] = function (connection, remoteIpPort, packetData) {
    debuglog('function REGISTER:'+ packetData);
    //"userid|nick|name|passwd|tel"
    //"userid|passwd|nick"
    var aryData = packetData.split(TCP_DELIMITER);   
    chatDb.registerUser(aryData, whenRegisterCompletes);

    function whenRegisterCompletes(err) {
        debuglog("whenRegisterCompletes");
        var returnStr = getErrString( 'REGISTER', err);

        sendMsgToClient(connection, returnStr);
    }
}  ;

////////////////////////////////////////////////////////////////////////////////
serverFunctions ['ADDFRIEND'] = function (connection, remoteIpPort, packetData) {
    console.log('function ADDFRIEND:'+ packetData);  //kojh|ddd
    var aryData = packetData.split(TCP_DELIMITER);   
    var userid   = aryData[0];
    var friendid = aryData[1];
    var friendNick="";
    //friendid validation
    chatDb.validateFriendId(friendid, whenIdValidationResultComes);

    function whenIdValidationResultComes(err, idExists, nick) {
        friendNick = nick;
        debuglog("whenIdValidationResultComes:"+ idExists+" /nick:"+friendNick);
        if( idExists == 0) {
            sendMsgToClient(connection, "ADDFRIEND|FAIL|No Such Friend ID");
            return;
        }
        //friendid exists,
        chatDb.addMyFriend(userid, friendid, whenAddFriendOfMineResultComes);
    }

    function whenAddFriendOfMineResultComes() {
        chatDb.addMyFriend(friendid, userid, whenAddFriendResultComes);
    }

    function whenAddFriendResultComes(err) {
        debuglog("whenAddFriendResultComes");
        //ADDFRIEND|OK|friendid|online
        //ADDFRIEND|FAIL|err string

        var returnStr = getErrString( 'ADDFRIEND', err);
        if(!err) {
            returnStr += TCP_DELIMITER + friendid;
            returnStr += TCP_DELIMITER + friendNick;
            returnStr += TCP_DELIMITER;
            
            if( friendid in clientConnectionsByUserID ) {
                //online now
                returnStr += "online";
            }else{
                returnStr += "offline";
            }
        }

        sendMsgToClient(connection, returnStr);
    }
}  ;

////////////////////////////////////////////////////////////////////////////////
serverFunctions ['FRIENDLIST'] = function (connection, remoteIpPort, packetData) {
    console.log('function FRIENDLIST:'+ packetData);    
    var friendList = [];
    var nickList = [];
    //"userid"
    var curCnt = 0;
    var aryData = packetData.split(TCP_DELIMITER);   
    var userid = aryData[0];
    debuglog("userid: " + userid);
    //대회목록. get my friend list, first get total count

    chatDb.getMyFriendCount(userid, whenMyListCountComes);

    function whenMyListCountComes(err, totalCnt) {
        debuglog("whenMyListCountComes:"+ totalCnt);
        if( totalCnt == 0) {
            sendMsgToClient(connection, "FRIENDLIST|");
            return;
        }
        //i got a count, then, get all list
        chatDb.getMyFriendList(userid, whenMyListComes, totalCnt);
    }

    function whenMyListComes(row, totalCnt) {
        debuglog("whenMyListComes:"+ totalCnt);

        curCnt++;
        debuglog("whenMyListComes:curCnt=>"+curCnt+"totalCnt=>"+ totalCnt+ 
            " /friendid:" +row.friendid+"/nick:" +row.nick);
        friendList.push (row.friendid); 
        nickList.push (row.nick); 

        clientConnectionsByUserID[userid].friendList.push (row.friendid); 
        clientConnectionsByRemoteIpPort[remoteIpPort].friendList.push (row.friendid); 
        //clientConnectionsByConn[connection].friendList.push (rows.friend.toString()); 

        debuglog("friendList.length: " + friendList.length);

        if(curCnt === totalCnt) {
            //got all rows=> send back to client
            var friendListStr="FRIENDLIST|";
            for(var i in friendList) {
                //friendId1|online|friendId2|offline|....
                friendListStr += friendList[i];
                friendListStr += TCP_DELIMITER;
                friendListStr += nickList[i];
                friendListStr += TCP_DELIMITER;
                if( friendList[i] in clientConnectionsByUserID ) {
                    //online now
                    friendListStr += "online";
                }else{
                    friendListStr += "offline";
                }
                friendListStr += TCP_DELIMITER;
            }

            debuglog("friendListStr: " + friendListStr); // FRIENDLIST|id|nick|online|...
            
            sendMsgToClient(connection, friendListStr);

            var notiMsg = "LOGGED-IN|" + userid +TCP_DELIMITER+clientConnectionsByUserID[userid].nick;
            broadcastMsg (userid, notiMsg);
        }
    }
} ;

////////////////////////////////////////////////////////////////////////////////
serverFunctions ['LOGIN'] = function (connection, remoteIpPort, packetData) {
    console.log('function LOGIN:'+ packetData);    
    //var curCnt = 0;
    //var friendList = [];
    //"userid|passwd"
    var aryData = packetData.split(TCP_DELIMITER);   
    var userid = aryData[0];
    var passwd = aryData[1];
    debuglog("userid: " + userid);
    debuglog("passwd: " + passwd);
    
    //인증
    chatDb.authUser(userid,passwd, whenAuthCompletes);
    
    function whenAuthCompletes(err, result, nick) {
        debuglog("whenAuthCompletes");
        var returnStr = "";
        if(0===result) {
            debuglog("err: No data found");
            returnStr = "LOGIN|FAIL|Check your id and password!";
        } else {
            returnStr = getErrString( 'LOGIN', err);

            if(!err) {
                debuglog("로그인 성공시, 사용자정보를 저장.["+userid+"] nick["+nick+"] ip["+ remoteIpPort+"]");
                
                //clientConnectionsByUserID[userid] = connection;
                clientConnectionsByUserID[userid] = new ClientData( connection,userid ,nick, remoteIpPort);  

                //clientConnectionsByRemoteIpPort[remoteIpPort] = connection;
                clientConnectionsByRemoteIpPort[remoteIpPort] = new ClientData( connection,userid ,nick, remoteIpPort);  
                
            } else {
                debuglog("로그인 ERROR");
            }
        }
        sendMsgToClient(connection, returnStr);
    }
} ;


////////////////////////////////////////////////////////////////////////////////
//Main
////////////////////////////////////////////////////////////////////////////////
var server = net.createServer( function(c) {
    var accumulatingBuffer = Buffer.alloc(0); 
    var totalPacketLen   = -1; 
    var accumulatingLen  =  0;
    var recvedThisTimeLen=  0;
    var remoteAddress = c.remoteAddress;
    //var address= c.address();
    var remotePort= c.remotePort;
    var remoteIpPort = remoteAddress +":"+ remotePort;
    
    console.log('--------------------------------------------------'+remoteAddress);
    //console.log('port='+ address.port); 
    console.log('remoteIpPort='+ remoteIpPort); 

    c.on('data', function(data) {
        // 주고받는 packet => 패킷크기정보 헤더 (unsigned int 32bit) + 구분자로 나누어진 문자열 데이터
        // 헤더 정보에는 순수한 문자열 데이터 길이가 설정됨. 
        // 그러므로 전체 패킷의 길이는 4byte + 헤더에 설정된 크기.  
        //TODO : no dynamic buffer allocation 
        console.log('data 길이 :' + data.length ); //18
        console.log('data='+ data); // LOGIN|1|2
        
        recvedThisTimeLen = data.length;
        console.log('recvedThisTimeLen='+ recvedThisTimeLen);
        var tmpBuffer = Buffer.alloc( accumulatingLen + recvedThisTimeLen );
        accumulatingBuffer.copy(tmpBuffer);
        data.copy ( tmpBuffer, accumulatingLen  ); // offset for accumulating
        accumulatingBuffer = tmpBuffer; 
        tmpBuffer = null;
        accumulatingLen += recvedThisTimeLen ;
        console.log('accumulatingBuffer = ' + accumulatingBuffer  ); 
        console.log('accumulatingLen    =' + accumulatingLen );

        //if( recvedThisTimeLen < PACKET_HEADER_LEN ) {
        if (accumulatingLen < PACKET_HEADER_LEN) { //20150628 fixed: issued by mattipr
            console.log('need to get more data(less than header-length received) -> wait..');
            return;
        //} else if( recvedThisTimeLen == PACKET_HEADER_LEN ) {
        } else if( accumulatingLen == PACKET_HEADER_LEN ) { //20150628 fixed: issued by mattipr
            console.log('need to get more data(only header-info is available) -> wait..');
            return;
        } else {
            console.log('before-totalPacketLen=' + totalPacketLen ); 
            //a packet info is available..
            if( totalPacketLen < 0 ) {
                totalPacketLen = accumulatingBuffer.readUInt32BE(0) ; 
                console.log('totalPacketLen=' + totalPacketLen );
            }
        }    

        while( accumulatingLen >= totalPacketLen + PACKET_HEADER_LEN ) {
            console.log('누적된 데이터(' + accumulatingLen +') >= 헤더+데이터 길이(' + (totalPacketLen+PACKET_HEADER_LEN) +')' );
            console.log( 'accumulatingBuffer= ' + accumulatingBuffer );
            
            var aPacketBufExceptHeader = Buffer.alloc( totalPacketLen  ); // a whole packet is available...
            console.log( 'aPacketBufExceptHeader len= ' + aPacketBufExceptHeader.length );
            accumulatingBuffer.copy( aPacketBufExceptHeader, 0, PACKET_HEADER_LEN, accumulatingBuffer.length); // 
            
            ////////////////////////////////////////////////////////////////////
            //process packet data
            var stringData = aPacketBufExceptHeader.toString();
            var usage = stringData.substring(0,stringData.indexOf(TCP_DELIMITER));
            console.log("usage: " + usage);
            //call handler
            (serverFunctions [usage])(c, remoteIpPort, stringData.substring(1+stringData.indexOf(TCP_DELIMITER)));
            ////////////////////////////////////////////////////////////////////
            
            //나머지 버퍼 재구성
            var newBufRebuild = Buffer.alloc( accumulatingBuffer.length - (totalPacketLen + PACKET_HEADER_LEN) ); //20150628 fixed: issued by mattipr
            newBufRebuild.fill();
            accumulatingBuffer.copy( newBufRebuild, 0, totalPacketLen + PACKET_HEADER_LEN, accumulatingBuffer.length  );
            
            //init      
            accumulatingLen -= (totalPacketLen +PACKET_HEADER_LEN) ;
            accumulatingBuffer = newBufRebuild;
            newBufRebuild = null;
            totalPacketLen = -1;
            console.log( 'Init: accumulatingBuffer= ' + accumulatingBuffer );   
            console.log( '      accumulatingLen   = ' + accumulatingLen );  

            //여러 패킷이 한번에 전송되는 경우를 대비
            if( accumulatingLen <= PACKET_HEADER_LEN ) {
                //need to get more data -> wait..
                return;
            } else {
                totalPacketLen = accumulatingBuffer.readUInt32BE(0) ; 
                console.log('totalPacketLen=' + totalPacketLen );
            }    
        } 
        console.log('....after while.....' );           
        
    }); //on.data
    
    //--------------------------------------------------------------------------
    c.on('end', function() {
        console.log('connection disconnected: '+ remoteIpPort);
        broadcastLogOut(remoteIpPort);
        
    });

    //c.on('drain', function() {
    //    console.log('connection drain: '+ remoteIpPort);
    //});
});

////////////////////////////////////////////////////////////////////////////////
function serverStart () {
    console.log("now listen!!!...");
    server.listen(SERVER_PORT, function() {
        console.log('server bound');
    });    
}
