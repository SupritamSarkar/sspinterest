
var createError = require('http-errors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var expressSession = require('express-session');
var passport = require('passport');
const MongoStore = require("connect-mongo");
const express = require('express');

var indexRouter = require('./routes/index');
var Users = require('./models/users');
var Post = require('./models/post');

const app = require('express')();
const http = require('http').Server(app);

const mongoose = require('mongoose');
mongoose.connect("mongodb+srv://Supritam:ss2003@ss.nn9rplh.mongodb.net/ab?retryWrites=true&w=majority&appName=SS");






// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(expressSession({
  resave: false,
  saveUninitialized: false, 
  secret:"iuhoihiuh",
}));

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(Users.serializeUser());
passport.deserializeUser(Users.deserializeUser());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', Users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

app.use('/uploads', express.static('public/uploads'));


// Make sure MongoDB is connected before using sessions



mongoose.connection.on("connected", () => {
  console.log(`Mongoose connected to ${mongoose.connection.host}:${mongoose.connection.port}`);
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});


// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


module.exports = app;
