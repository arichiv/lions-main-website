var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var express = require('express');
var expressSession = require('express-session');
var http = require('http');
var passport = require('passport')
var passportFacebook = require('passport-facebook');
var pg = require('pg');
var robots = require('robots.txt');

passport.use(new passportFacebook.Strategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://www.lionsmain.org/login/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      return done(null, profile);
    });
  }
));
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

var app = express();
app.set('port', process.env.PORT || 5000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use("/static/", express.static(__dirname + '/static/'));
app.use(robots(__dirname + '/robots.txt'))
app.use(cookieParser());
app.use(bodyParser());
app.use(expressSession({ secret: process.env.EXPRESS_SESSION_SECRET }));
app.use(passport.initialize());
app.use(passport.session());
app.get('/', function(req, res) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    res.render("index");
  });
});
app.get('/login', passport.authenticate('facebook'));
app.get(
  '/login/callback',
  passport.authenticate(
    'facebook',
    {
      successRedirect: '/edit',
      failureRedirect: '/'
    }
  )
);
app.get('/edit', ensureAuthenticated, function(req, res) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    res.render("edit", {uid: req.user.id});
  });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

http.createServer(app).listen(app.get('port'));
