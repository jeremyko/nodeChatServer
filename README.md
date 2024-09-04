nodeChatServer
==============
[https://jeremyko.github.io/2012/12/25/nodejs-tcp-chatting-server-with-qt.html](https://jeremyko.github.io/2012/12/25/nodejs-tcp-chatting-server-with-qt.html)

chat TCP server written in node.js (considering data fragmentation)
client: https://github.com/jeremyko/nodeChatClient


- How to run server :

        npm install sqlite3
    
        export NODE_DEBUG=main,db
    
        node main.js

- The database file will be created automatically if not exists.

- Packet data format consist of the header and body.

      header: 32bit unsigned int. this means body length.
      
      body  : Message string


 
