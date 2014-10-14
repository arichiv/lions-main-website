var express = require('express');
var http = require('http');
var robots = require('robots.txt')

var app = express();

app.set('port', process.env.PORT || 5000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use("/static/", express.static(__dirname + '/static/'));
app.use(robots(__dirname + '/robots.txt'))
app.get('/', function(req, res) {
  res.render("index");
});

http.createServer(app).listen(app.get('port'));
