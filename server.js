#!/bin/env node
//  OpenShift sample Node application
var fs = require('fs');
var express = require('express');
var passport = require('passport');
var mongoose = require('mongoose');
var path = require('path');
var multer  = require('multer')
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var session = require('express-session');
var mongoose = require('mongoose');
var config = require('./config.js');
var User = require('./models/user.model.server.js');
var TwitterStrategy = require('passport-twitter').Strategy;
var app = express();
var OAuth= require('oauth').OAuth;
var oa;
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var domain = "cs5610-neelisagar.rhcloud.com";
var port = process.env.OPENSHIFT_NODEJS_PORT || 3000;

// serialize and deserialize
passport.serializeUser(function(user, done) {
  //console.log('serializeUser: ' + user._id);
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user){
    //console.log(user);
    if(!err)
      done(null, user);
    else
      done(err, null);
  });
});

app.use(express.logger());
app.use(bodyParser.json());
app.use(express.cookieParser());
app.use(methodOverride());
app.use(bodyParser.urlencoded({extended: true}));
app.use(multer());
//app.use(session({secret: 'mySecretKey', cookie: { secure: true }}));
app.use(session({secret: 'mySecretKey'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/public'));
app.use('/bower_components',  express.static(__dirname + '/public/bower_components'));

var connectionString = 'mongodb://127.0.0.1:27017/cs5610';

if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD) {
  connectionString = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
    process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
    process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
    process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
    process.env.OPENSHIFT_APP_NAME;
}

var db = mongoose.connect(connectionString);

require("./public/assignment/server/app.js")(app, db, mongoose);

require("./public/project/server/app.js")(app, passport, oa);


function initTwitterOauth() {
  oa = new OAuth(
    "https://twitter.com/oauth/request_token"
    , "https://twitter.com/oauth/access_token"
    , config.consumer_key
    , config.consumer_secret
    , "1.0A"
    //, "http://" + ipaddress + ":" + port + "/auth/twitter/callback"
    , "http://" + domain + "/auth/twitter/callback"
    , "HMAC-SHA1"
  );
}

passport.use(new TwitterStrategy({
    consumerKey     : config.consumer_key,
    consumerSecret  : config.consumer_secret,
    callbackURL     : "http://" + domain + "/auth/twitter/callback"
    //callbackURL     : "http://" + ipaddress + ":" + port + "/auth/twitter/callback"
  },
  function(token, tokenSecret, profile, done) {

    // make the code asynchronous
    // User.findOne won't fire until we have all our data back from Twitter
    process.nextTick(function() {
      console.log(token);
      console.log(tokenSecret);
      console.log(profile);
      initTwitterOauth();
      User.findOne({ 'id' : profile.id }, function(err, user) {
        // if there is an error, stop everything and return that
        // ie an error connecting to the database
        if (err) {
          console.log(err);
          return done(err);
        }
        // if the user is found then log them in
        if (user) {
          return done(null, user); // user found, return that user
        } else {
          // if there is no user, create them
          var newUser = new User();
          // set all of the user data that we need
          newUser.id = profile.id;
          newUser.token = token;
          newUser.tokenSecret = tokenSecret;
          newUser.username = profile.username;
          newUser.displayName = profile.displayName;
          newUser.lastStatus = profile._json.status.text;
          newUser.image = profile._json.profile_image_url;
          // save our user into the database
          newUser.save(function(err) {
            if (err)
              throw err;
            console.log("saving user....");
            return done(null, newUser);
          });
        }
      });
    });

  }));

initTwitterOauth();

app.listen(port, ipaddress, function() {
  console.log('Listening at http://%s:%s', ipaddress, port);
});

app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/account', ensureAuthenticated, function(req, res){
  User.findById(req.session.passport.user, function(err, user) {
    if(err) {
      console.log(err);  // handle errors
    }
    res.json(user);
  });
});

app.get('/auth/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/#/login' }),
  function(req, res) {
    res.redirect('project/client/index.html#/dashboard/profile');
    //res.redirect('project/client/index.html#/home');
  });

app.post('/logout', function(req, res) {
  req.logOut();
  res.send(200);
  //res.redirect('/');
});

app.get('/twitter/tweet', function (req, res) {
  User.findById(req.session.passport.user, function(err, user) {
    if(err) {
      console.log(err);  // handle errors
    }
    makeTweet(user, function (error, data) {
      if(error) {
        console.log(require('sys').inspect(error));
        res.end('bad stuff happened');
      } else {
        console.log(data);
        res.end('go check your tweets!');
      }
    });
  });
});

app.get('/twitter/direct/:sn', function (req, res) {
  makeDm(req.params.sn, req.session.passport.user, function (error, data) {
    if(error) {
      console.log(require('sys').inspect(error));
      res.end('bad stuff happened (dm)');
    } else {
      console.log(data);
      res.end("the message sent (but you can't see it!");
    }
  });
});


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.send('0');
  //res.redirect('/');
}

function makeTweet(user, cb) {
  //console.log("Make tweet " + user.token);
  //console.log("Make tweet " + user.tokenSecret);
  oa.post(
    "https://api.twitter.com/1.1/statuses/update.json"
    , user.token
    , user.tokenSecret
    , {"status": "This is how you tweet and direct message" }
    , cb
  );
}

function makeDm(sn, user, cb) {
  oa.post(
    "https://api.twitter.com/1.1/direct_messages/new.json"
    , user.token
    , user.tokenSecret
    , {"screen_name": sn, text: "test message via nodejs twitter api. pulled your sn at random, sorry."}
    , cb
  );
}
