var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var express = require('express');
var expressSession = require('express-session');
var formidable = require('formidable');
var fs = require('fs');
var http = require('http');
var imagemagick = require('imagemagick');
var passport = require('passport')
var passportFacebook = require('passport-facebook');
var pg = require('pg');
var robots = require('robots.txt');
var sequelize = require('sequelize');

// Auth setup
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

// DB setup
var match = process.env.DATABASE_URL.match(
  /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/
)
var db = new sequelize(match[5], match[1], match[2], {
  dialect: 'postgres',
  protocol: 'postgres',
  port: match[4],
  host: match[3],
  logging: console.log
})
var LMACProfile = db.define(
  'LMACProfile',
  {
    uid: { type: sequelize.STRING, primaryKey: true},
    enabled: { type: sequelize.BOOLEAN, defaultValue: false },
    name: { type: sequelize.TEXT, defaultValue: '' },
    website: { type: sequelize.TEXT, defaultValue: '' },
    biography: { type: sequelize.TEXT, defaultValue: '' }
  }
)
var LMACProfileImage = db.define(
  'LMACProfileImage',
  {
    uid: { type: sequelize.STRING, primaryKey: true},
    data: { type: sequelize.BLOB, defaultValue: '' },
  }
)


// App setup
var app = express();
app.set('port', process.env.PORT || 5000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use("/static/", express.static(__dirname + '/static/'));
app.use(robots(__dirname + '/robots.txt'))
app.use(cookieParser(process.env.EXPRESS_SESSION_SECRET));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(expressSession({
  secret: process.env.EXPRESS_SESSION_SECRET,
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.get('/', function(req, res) {
  res.render("about", {page: 'about'});
});
app.get('/shows', function(req, res) {
  res.render("shows", {page: 'shows'});
});
app.get('/artists', function(req, res) {
  LMACProfile
  .findAll({
    where: { enabled: true },
    order: 'name',
  })
  .then(function(profiles) {
    res.render("artists", {page: 'artists', profiles: profiles});
  });
});
app.get('/image/:uid', function(req, res) {
  LMACProfileImage
    .find({
      where: { uid: req.param("uid") },
    })
    .then(function(image) {;
      if (image) {
        imagemagick.resize({
          srcData: image.data,
          height: 300,
          width: 300
        }, function(err, stdout, stderr){
          res.contentType("image/jpeg");
          res.end(stdout, 'binary');
        });
      } else {
        fs.readFile('static/logo_square.png', 'base64', function (err, data) {
          var img = new Buffer(data, 'base64');
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': img.length
          });
          res.end(img);
        });
      }
    });
});
app.get(
    '/login',
    passport.authenticate('facebook')
);
app.get(
  '/login/callback',
  passport.authenticate(
    'facebook',
    { successRedirect: '/edit', failureRedirect: '/' }
  )
);
app.get('/edit', function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/login');
    return;
  }
  LMACProfile
    .findOrCreate({
      where: { uid: req.user.id },
      defaults: { uid: req.user.id }
    })
    .spread(function(profile, created) {
      res.render("edit", {profile: profile});
    })
});
app.post('/edit-save', function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/login');
    return;
  }
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {
    LMACProfile
      .find({
        where: { uid: req.user.id },
      })
      .then(function(profile) {
        profile.enabled = Boolean(fields.enabled);
        profile.name = fields.name;
        var website = fields.website;
        if (website.substr(0, 4) != 'http') {
          website = 'http://' + website;
        }
        profile.website = website;
        profile.biography = fields.biography;
        profile.save().then(function() {
          if (files.image.size) {
            fs.readFile(files.image.path, 'base64', function (err, data) {
              var img = new Buffer(data, 'base64');
              LMACProfileImage
                .findOrCreate({
                  where: { uid: req.user.id },
                  defaults: { uid: req.user.id }
                })
                .spread(function(image, created) {
                  image.data = img;
                  image.save().then(function() {
                    res.redirect('/edit');
                  });
                });
            });
          } else {
            res.redirect('/edit');
          }
        });
      });
  });
});

db.sync().then(function() {
  http.createServer(app).listen(app.get('port'));
});
