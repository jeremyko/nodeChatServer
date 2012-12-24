/**
 * New node file
 */
var net = require('net');
//var fsys = require('fs');
var util = require('util');
var chatDb = require('./db');

chatDb.checkAndCreateDB( serverStart );

////////////////////////////////////////////////////////////////////////////////

/**
 * 구현할 기능들:
 * 1. 최초 사용자 등록하기 (별명, 이름, 비번, 연락처 ) OK
 * 2. 대화상대 추가하기  
 * 2. 로그인시 인증 및 사용자 정보(대화목록) 보내주기 OK
 * 3. 로그인 여부를 모두에게 알리기 OK
 * 4. 채팅 메시지 전달하기 
 * 5. 로그 아웃시 모두에게 알리기. OK
 */
var SERVER_PORT = 8124;
var TCP_DELIMITER = '|';
var packetHeaderLen = 4; // 32 bit integer --> 4
//var packetInfoFieldLen = 5+1; //65536| --> string packet

////////////////////////////////////////////////////////////////////////////////
//var clientConnectionsByConn    = {}; //impossible, only string key...
//var onlineUsers  = {};
var clientConnectionsByUserID  = {}; //connection only
//var clientInfoByUserID  = {}; //except conection
var clientConnectionsByRemoteIpPort    = {};
//var clientInfoByRemoteIpPort    = {};

function ClientData (conn, userid, ipaddr)
{
    this.connection = conn;
    this.userId=userid;
    this.ipAddr=ipaddr;
    this.friendList = []; // userid 
}

////////////////////////////////////////////////////////////////////////////////
/*
REGISTER
LOGIN
FRIENDLIST
CHKID
ADDFRIEND
DELETEFRIEND
CHATMSG
*/

function broadcastMsg ( me, notiMsg) {
    //대화상대들에게 알림
    util.debug("broadcastMsg:"+me);
    var toNotifyList = clientConnectionsByUserID[me].friendList;
    
    for( var id in toNotifyList) { // for 고려!!
        util.debug("toNotifyList: " + toNotifyList[id]);
        if( clientConnectionsByUserID[ toNotifyList[id] ]) {
            util.debug("notify To: " + toNotifyList[id]);
            sendMsgToClient(clientConnectionsByUserID[ toNotifyList[id] ].connection, notiMsg);    
        }
    }
}

function broadcastLogOut( remoteIpPort) {
    util.debug("broadcastLogOut:"+remoteIpPort);
    var connOfMe = clientConnectionsByRemoteIpPort[remoteIpPort];    
    if(connOfMe) {
        var notiMsg = "LOGGED-OUT|" + connOfMe.userId ;
        var toNotifyList = connOfMe.friendList;
    
        for( var id in toNotifyList) { // for 고려!!
            if( clientConnectionsByUserID[ toNotifyList[id] ]) {
                util.debug("notify To: " + toNotifyList[id]);
                sendMsgToClient(clientConnectionsByUserID[ toNotifyList[id] ].connection, notiMsg, deleteClient);    
            }else{
                delete clientConnectionsByUserID[connOfMe.userId];
                delete clientConnectionsByRemoteIpPort[remoteIpPort]; 
            }
        }   
    }

    function deleteClient() {
        util.debug("deleteClient");
        delete clientConnectionsByUserID[connOfMe.userId];
        delete clientConnectionsByRemoteIpPort[remoteIpPort]; 
    }
}

//functions
////////////////////////////////////////////////////////////////////////////////
var serverFunctions   = {};

function sendMsgToClient(connection, msg, cb) {
    var buffMsg = new Buffer(msg);
    var msgLen = buffMsg.length ;
    //packet length info
    var bufPacketLenInfo = new Buffer(4);
    bufPacketLenInfo.fill();
    var headerLen= bufPacketLenInfo.length;
    bufPacketLenInfo.writeUInt32BE(msgLen, 0); 
    
    var bufTotal = new Buffer(  headerLen + msgLen ); //packet length info + msg
    bufTotal.fill();
    //console.log('bufTotal.length =%d', bufTotal.length);    
    bufPacketLenInfo.copy(bufTotal, 0, 0, headerLen);
    buffMsg.copy(bufTotal, headerLen, 0, msgLen );
    
    console.log('SEND:['+bufTotal.length+']['+ bufTotal + ']');
    if(cb) {
        connection.write(bufTotal, cb );
    }else{
        connection.write(bufTotal, function () { util.debug("written out!"); });
    }
}

////////////////////////////////////////////////////////////////////////////////
function getErrString(usage, err) {
    var returnStr="";
    if(err) {
        util.debug("err:"+err.toString());
        returnStr = usage + "|FAIL|"+err.toString();
    }else{
        returnStr = usage + "|OK";
    }

    return returnStr;
}
////////////////////////////////////////////////////////////////////////////////

serverFunctions ['CHATMSG'] = function (connection, remoteIpPort, packetData) {
    var packetDataCopy = packetData;
    console.log('function CHATMSG:'+ packetData);  //userid|friendid|msg
    var aryData = packetData.split(TCP_DELIMITER);   
    var userid   = aryData[0];
    var friendid = aryData[1];
    var chatMsg = aryData[2];
    var friendOnline = clientConnectionsByUserID[friendid];
    if(friendOnline != undefined) {
        sendMsgToClient( clientConnectionsByUserID[friendid].connection, 'CHATMSG'+TCP_DELIMITER+packetDataCopy);    
    } else {
        util.debug('ERR: friendid is NOT ONLINE!'+ friendid);
    }

}

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
        util.debug("whenAddFriendResultComes");
        //DELETEFRIEND|OK|friendid
        //DELETEFRIEND|FAIL|err string
        var returnStr = getErrString( 'DELETEFRIEND', err);
        if(!err) {
            returnStr += TCP_DELIMITER + friendid;
        }

        sendMsgToClient(connection, returnStr);
    }
}
////////////////////////////////////////////////////////////////////////////////
serverFunctions ['CHKID'] = function (connection, remoteIpPort, packetData) {
    util.debug('function CHKID:'+ packetData);
    //"userid"
    var aryData = packetData.split(TCP_DELIMITER);   
    chatDb.checkUserId(aryData, whenCheckIdCompletes);

    function whenCheckIdCompletes(err,userExists) {
        util.debug("whenCheckIdCompletes");
        var returnStr = "";
        if( userExists > 0) { //user already exists!
            returnStr = "CHKID|FAIL|userid already exists!";
        } else {
            returnStr = getErrString( 'CHKID', err);
        }
    
        //send back TODO 
        sendMsgToClient(connection, returnStr);
    }
}

////////////////////////////////////////////////////////////////////////////////
serverFunctions ['REGISTER'] = function (connection, remoteIpPort, packetData) {
    util.debug('function REGISTER:'+ packetData);
    //"userid|nick|name|passwd|tel"
    //"userid|passwd|nick"
    var aryData = packetData.split(TCP_DELIMITER);   
    chatDb.registerUser(aryData, whenRegisterCompletes);

    function whenRegisterCompletes(err) {
        util.debug("whenRegisterCompletes");
        var returnStr = getErrString( 'REGISTER', err);

        sendMsgToClient(connection, returnStr);
    }
}


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
        util.debug("whenIdValidationResultComes:"+ idExists+" /nick:"+friendNick);
        if( idExists == 0) {
            sendMsgToClient(connection, "ADDFRIEND|FAIL|No Such Friend ID");
            return;
        }
        //friendid exists,
        chatDb.addMyFriend(userid, friendid, whenAddFriendResultComes);
    }

    function whenAddFriendResultComes(err) {
        util.debug("whenAddFriendResultComes");
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
}

////////////////////////////////////////////////////////////////////////////////
serverFunctions ['FRIENDLIST'] = function (connection, remoteIpPort, packetData) {
    console.log('function FRIENDLIST:'+ packetData);    
    var friendList = [];
    var nickList = [];
    //"userid"
    var curCnt = 0;
    var aryData = packetData.split(TCP_DELIMITER);   
    var userid = aryData[0];
    util.debug("userid: " + userid);
    //대회목록. get my friend list, first get total count

    chatDb.getMyFriendCount(userid, whenMyListCountComes);

    function whenMyListCountComes(err, totalCnt) {
        util.debug("whenMyListCountComes:"+ totalCnt);
        if( totalCnt == 0) {
            sendMsgToClient(connection, "FRIENDLIST|");
            return;
        }
        //i got a count, then, get all list
        chatDb.getMyFriendList(userid, whenMyListComes, totalCnt);
    }

    function whenMyListComes(row, totalCnt) {
        util.debug("whenMyListComes:"+ totalCnt);

        curCnt++;
        util.debug("whenMyListComes:curCnt=>"+curCnt+"totalCnt=>"+ totalCnt+ 
            " /friendid:" +row.friendid+"/nick:" +row.nick);
        friendList.push (row.friendid); 
        nickList.push (row.nick); 

        clientConnectionsByUserID[userid].friendList.push (row.friendid); 
        clientConnectionsByRemoteIpPort[remoteIpPort].friendList.push (row.friendid); 
        //clientConnectionsByConn[connection].friendList.push (rows.friend.toString()); 

        util.debug("friendList.length: " + friendList.length);

        if(curCnt === totalCnt) {
            //got all rows=> send back to client
            var friendListStr="FRIENDLIST|";
            for(var i in friendList) {
                //util.debug("friendList.element: " + friendList[i]);
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

            util.debug("friendListStr: " + friendListStr); // FRIENDLIST|id|nick|online|...
            
            sendMsgToClient(connection, friendListStr);

            var notiMsg = "LOGGED-IN|" + userid ;
            broadcastMsg (userid, notiMsg);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////
serverFunctions ['LOGIN'] = function (connection, remoteIpPort, packetData) {
    console.log('function LOGIN:'+ packetData);    
    var curCnt = 0;
    var friendList = [];
    //"userid|passwd"
    var aryData = packetData.split(TCP_DELIMITER);   
    var userid = aryData[0];
    var passwd = aryData[1];
    util.debug("userid: " + userid);
    util.debug("passwd: " + passwd);
    
    //인증
    chatDb.authUser(userid,passwd, whenAuthCompletes);
    
    function whenAuthCompletes(err, result) {
        util.debug("whenAuthCompletes");
        var returnStr = "";
        if(0===result) {
            util.debug("err: No data found");
            returnStr = "LOGIN|FAIL|Check your id and password!";
        } else {
            returnStr = getErrString( 'LOGIN', err);

            if(!err) {
                util.debug("로그인 성공시, 사용자정보를 저장.["+userid+"] ip["+ remoteIpPort+"]");
                
                //clientConnectionsByUserID[userid] = connection;
                clientConnectionsByUserID[userid] = new ClientData( connection,userid ,remoteIpPort);  

                //clientConnectionsByRemoteIpPort[remoteIpPort] = connection;
                clientConnectionsByRemoteIpPort[remoteIpPort] = new ClientData( connection,userid ,remoteIpPort);  
                
            } else {
                util.debug("로그인 ERROR");
            }
        }
        sendMsgToClient(connection, returnStr);
    }
}


////////////////////////////////////////////////////////////////////////////////
//Main
////////////////////////////////////////////////////////////////////////////////
var server = net.createServer( function(c) {
    var accumulatingBuffer = new Buffer(0); 
    var totalPacketLen   = -1; 
    var accumulatingLen  =  0;
    var recvedThisTimeLen=  0;
    var remoteAddress = c.remoteAddress;
    var address= c.address();
    var remotePort= c.remotePort;
    var remoteIpPort = remoteAddress +":"+ remotePort;
    
    console.log('--------------------------------------------------'+remoteAddress);
    //console.log('port='+ address.port); 
    console.log('remoteIpPort='+ remoteIpPort); 

    
    //--------------------------------------------------------------------------
    c.on('data', function(data) {
        // 주고받는 packet => 패킷크기정보 헤더 (unsigned int 32bit) + 구분자로 나누어진 문자열 데이터
        // 헤더 정보에는 순수한 문자열 데이터 길이가 설정된다. 
        // 그러므로 전체 패킷의 길이는 4byte + 헤더에 설정된 크기임.  
        console.log('data 길이 :' + data.length ); //18
        console.log('data='+ data); // LOGIN|1|2
        //debug 
        //for( var i =0 ; i < data.length; i ++) {
        //    console.log('data['+i+']='+ data[i]);
        //}
        
        recvedThisTimeLen = data.length;
        console.log('recvedThisTimeLen='+ recvedThisTimeLen);
        var tmpBuffer = new Buffer( accumulatingLen + recvedThisTimeLen );
        accumulatingBuffer.copy(tmpBuffer);
        data.copy ( tmpBuffer, accumulatingLen  ); // offset for accumulating
        accumulatingBuffer = tmpBuffer;	
        accumulatingLen += recvedThisTimeLen ;
        console.log('accumulatingBuffer = ' + accumulatingBuffer  ); 
        console.log('accumulatingLen    =' + accumulatingLen );

        if( recvedThisTimeLen < packetHeaderLen ) {
            console.log('need to get more data(less than header-length received) -> wait..');
            return;
        } else if( recvedThisTimeLen == packetHeaderLen ) {
            console.log('need to get more data(only header-info is available) -> wait..');
            //console.log('only header info received, wait :'+ accumulatingBuffer.readUInt32BE(0));
            return;
        } else {
        	console.log('before-totalPacketLen=' + totalPacketLen ); 
        	//a packet info is available..
        	if( totalPacketLen < 0 ) {
        		totalPacketLen = accumulatingBuffer.readUInt32BE(0) ; 
        		console.log('totalPacketLen=' + totalPacketLen );
        	}
        }    

        while( accumulatingLen >= totalPacketLen + packetHeaderLen ) {
            // 현재 누적된 데이터 양이 받아야 할 길이와 같거나 많음 .
            //accumulatingBuffer 에서 packetHeaderLen offset 만큼 이후부터  totalPacketLen 만큼처리 
            console.log('누적된 데이터(' + accumulatingLen +') >= 헤더+데이터 길이(' + (totalPacketLen+packetHeaderLen) +')' );
            console.log( 'accumulatingBuffer= ' + accumulatingBuffer );
            
            var aPacketBufExceptHeader = new Buffer( totalPacketLen  ); // a whole packet is available...
            //buf.copy(targetBuffer, [targetStart], [sourceStart], [sourceEnd])
            console.log( 'aPacketBufExceptHeader len= ' + aPacketBufExceptHeader.length );
        	accumulatingBuffer.copy( aPacketBufExceptHeader, 0, packetHeaderLen, accumulatingBuffer.length); // 
            
            ////////////////////////////////////////////////////////////////////
        	handlePackets( aPacketBufExceptHeader); //process packet data
            ////////////////////////////////////////////////////////////////////
        	
        	//패킷 길이만큼 제외한 나머지 버퍼를 재구성한 후,  set 
        	var newBufRebuild = new Buffer( accumulatingBuffer.length );
        	newBufRebuild.fill();
        	accumulatingBuffer.copy( newBufRebuild, 0, totalPacketLen + packetHeaderLen, accumulatingBuffer.length  );
        	
     		//init      
        	accumulatingLen -= (totalPacketLen +4) ;
        	accumulatingBuffer = newBufRebuild;
        	totalPacketLen = -1;
            console.log( 'Init: accumulatingBuffer= ' + accumulatingBuffer );	
            console.log( '      accumulatingLen   = ' + accumulatingLen );	

            //여러 패킷이 한번에 전송되는 경우를 대비
            if( accumulatingLen <= packetHeaderLen ) {
                //need to get more data -> wait..
                return;
            } else {
                totalPacketLen = accumulatingBuffer.readUInt32BE(0) ; 
                console.log('totalPacketLen=' + totalPacketLen );
            }    
        } 
        console.log('....after while.....' );

        function handlePackets(packetData) {
            console.log('handlePackets:packetData:'+ packetData);
            var stringData = packetData.toString();
            var usage = stringData.substring(0,stringData.indexOf(TCP_DELIMITER));
            console.log("usage: " + usage);
            //call handler
            (serverFunctions [usage])(c, remoteIpPort, stringData.substring(1+stringData.indexOf(TCP_DELIMITER)));
        }                  
        
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
