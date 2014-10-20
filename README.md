nodeChatServer
==============
http://jeremyko.blogspot.kr/2012/12/nodejs-tcp-chatting-server-with-qt.html#more

chat TCP server written in node.js (considering data fragmentation)
client: https://github.com/jeremyko/nodeChatClient


- How to run server :

    npm install sqlite3

    node main.js

- The database file will be created automatically if not exists.


- Packet data format consist of the header and body.

  header: 32bit unsigned int. this means body length.
  
  body  : Message string


 
LICENSE
-------

This projected is licensed under the terms of the BSD license.
