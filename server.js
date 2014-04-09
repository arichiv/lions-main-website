var express = require('express');
var app = express();
app.use(express.static(__dirname + '/'));
var http = require('http');
var port = process.env.PORT || 5000;
var server = http.createServer(app);
server.listen(port);
