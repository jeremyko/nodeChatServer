/**
 * New node file
 */
var net = require('net');

var fsys = require('fs');
var util = require('util');
var chatDb = require('./db');

chatDb.CheckAndCreateDB( StartListen );

////////////////////////////////////////////////////////////////////////////////

var server = net.createServer( function(c) {

    console.log('server connected');

    // Get client info
                
    // send back data to client
    c.write('your data ..... !!\r\n');
    // broadcast login

    // chat messages
    c.on('data', function(data) {
        // parse msg (to who? usage...)

        console.log('client msg:');
        c.write(data); //echo !!
       });

    c.on('end', function() {
        console.log('server disconnected');
       });
                 
    c.write('hello\r\n');
               
    //c.pipe(c);
});

function StartListen () {
    console.log("now listen!!!...");
          
    server.listen(8124, function() {
        console.log('server bound');
    });    
}
//server.listen(8124, function() {
//  console.log('server bound');
//});

//console.log('test!');
//db

//login

//chat

//file transfer
 