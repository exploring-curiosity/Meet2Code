
const http = require('http');
const express = require('express');
const app = express();
const path=require('path');
const server = http.createServer(app);
const {ExpressPeerServer} = require('peer');

const port = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname)));


const peerServer = ExpressPeerServer(server, {
    proxied: true,
    debug: true,
    path: '/peerjs',
    ssl: {}
});

app.use(peerServer);

peerServer.on('connection',(client) => {
})

app.get('/',(req,res)=>{
    res.send('server is up and running');
});

server.listen(port,()=>{
    console.log("Server listening on port 8080");
});