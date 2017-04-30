// import robot api deps
import five from 'johnny-five';
import raspi from 'raspi-io';
// import { SoftPWM } from 'raspi-soft-pwm';

// import hardware interfaces
import { setDrivetrain } from './drivers/drv8833';
import { setPanAndTilt } from './drivers/panAndTilt';
// import { setLED } from './drivers/LED';

// import camera process interface
import fs from 'fs';
import { spawn } from 'child_process';

// import api deps
var express = require('express');
var app = express();
var http = require('http').Server(app);
var httpStream = require('http')
var io = require('socket.io')(http);
var path = require('path');
const WebStreamerServer = require('./lib/raspivid'); // ************

// setup hardware api
var sockets = {};

// config event emitters
process.setMaxListeners(11);

// setup proc
let proc;

// Create board with gpio
const board = new five.Board({
  io: new raspi()
});

// serve h264-live-player from vendor REPLACE WITH NPM PACKAGE
app.use(express.static(__dirname + '/vendor/dist'));

// serve stream
app.use('/stream', express.static(path.join(__dirname, '/stream')));

// server client
app.use('/', express.static(path.join(__dirname, '/client')));

// serve client
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

// Initialize board
board.on('ready', function() {

  // POLOLU DRV8833 Dual H-bridge Configuration
  const drivetrain = {

    // right motor
  	ain: new five.Motor({
  		pins: {
  			pwm: 24, // white wire // AIN2
  			dir: 2 // red wire // AIN1
  		},
  		invertPWM: true
  	}),

  	// left motor
  	bin: new five.Motor({
  		pins: {
  			pwm: 26, // brown wire // BIN2
  			dir: 7 // black wire // BIN1
  		},
  		invertPWM: true
  	})
  };

  // Mini Pan-Tilt Kit configuration
  const panAndTilt = {

    // pan servo
    pan: new five.Servo(23),

    // tilt servo
    tilt: new five.Servo(1),

  };

  // Software state LED configuration
  // const LED = {
  // 	red: new SoftPWM({
  // 		pin: 6,
  // 		range: 255,
  // 		frequency: 800
  // 	}),
  // 	green: new SoftPWM({
  // 		pin: 10,
  // 		range: 255,
  // 		frequency: 800
  // 	}),
  // 	blue: new SoftPWM({
  // 		pin: 11,
  // 		range: 255,
  // 		frequency: 800
  // 	})
  // };

  // initialize motors
  setDrivetrain(drivetrain, 1, 1);
  setDrivetrain(drivetrain, 0, 0);

  io.emit('log message', 'board ready');
  console.log('System ready');

  // client connection
  io.on('connection', function(socket) {

    // log total clients connected
    sockets[socket.id] = socket;
    console.log("Total clients connected: " + Object.keys(sockets).length);

    // log user connections
    io.emit('log message', 'a user has connected');
    console.log('A user has connected');

    // client disconnection
    socket.on('disconnect', function() {
      delete sockets[socket.id];

      // if no more sockets, kill the stream
      stopStreaming(io);

      io.emit('log message', 'a user has disconnected');
      console.log('A user has disconnected');
    });

    // to start a stream
    socket.on('start-stream', function() {
      startStreaming(io);
      io.emit('log message', 'starting video stream');
    });

    // log message to client
    socket.on('log message', function(msg) {
      io.emit('log message', msg);
      console.log('Log message: ' + msg);
    });

    // handle gpio
    socket.on('gpio', function(req) {
      let request = req;

      switch (req) {
        case 'forward':
          setDrivetrain(drivetrain, 1, 1);
          break;
        case 'rotate right':
          setDrivetrain(drivetrain, -1, 1);
          break;
        case 'backwards':
          setDrivetrain(drivetrain, -1, -1);
          break;
        case 'rotate left':
          setDrivetrain(drivetrain, 1, -1);
          break;
        case 'camera up':
          setPanAndTilt('up');
          break;
        case 'camera left':
          setPanAndTilt('left');
          break;
        case 'camera down':
          setPanAndTilt('down');
          break;
        case 'camera right':
          setPanAndTilt('right');
          break;
        case 'stop':
        default:
          setDrivetrain(drivetrain, 0, 0);
      }

      console.log('GPIO request: ' + request);

      return;
    });
  });
});

// start listening on port 8080
http.listen(8080, function() {
  console.log('listening on *:8080');
});

// for live stream ???
const server  = httpStream.createServer(app);
const silence = new WebStreamerServer(server);

server.listen(8081);

function stopStreaming(io) {
  // kill live stream process
  if (Object.keys(sockets).length == 0) {
    if (proc) {
      proc.kill();
    }

    // set api state
    app.set('watchingFile', false);

    // unwatch image_stream
    fs.unwatchFile('./stream/image_stream.jpg');

    console.log('Stream killed');
    io.emit('log message', 'Stream Killed');
  }
}

function startStreaming(io) {
  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', './stream/image_stream.jpg?_t=' + (Math.random() * 100000));
    return;
  }

  const args = ["-w", "640", "-h", "480", "-o", "./stream/image_stream.jpg", "-t", "1", "-tl", "1", "--nopreview", "--exposure", "sports"];

  // spawn live-stream process
  proc = spawn('raspistill', args);

  console.log('Watching for changes...');

  // set api state
  app.set('watchingFile', true);

  // watch image_stream
  fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
    io.sockets.emit('liveStream', './stream/image_stream.jpg?_t=' + (Math.random() * 100000));
  });
}
