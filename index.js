// import robot api deps
import five from 'johnny-five';
import raspi from 'raspi-io';
// import { SoftPWM } from 'raspi-soft-pwm';

// import hardware interfaces
import { setDrivetrain } from './drivers/drv8833';
// import { setLED } from './drivers/LED';

// import camera process interface
import fs from 'fs';
import { spawn } from 'child_process';

// import api deps
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');

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
  console.log('board ready');

  // client connection
  io.on('connection', function(socket) {

    // log total clients connected
    sockets[socket.id] = socket;
    console.log("Total clients connected : " + Object.keys(sockets).length);

    // log user connections
    io.emit('log message', 'a user has connected');
    console.log('a user connected');

    // client disconnection
    socket.on('disconnect', function() {
      delete sockets[socket.id];

      // if no more sockets, kill the stream
      stopStreaming(io);

      io.emit('log message', 'a user has disconnected');
      console.log('user disconnected');
    });

    // to start a stream
    socket.on('start-stream', function() {
      startStreaming(io);
      io.emit('log message', 'starting video stream');
    });

    // log message to client
    socket.on('log message', function(msg) {
      io.emit('log message', msg);
      console.log('message: ' + msg);
    });

    // handle gpio
    socket.on('gpio', function(req) {
      switch (req) {

        case 'forward':
          setDrivetrain(drivetrain, 1, 1);
          console.log('message: ' + req);
          break;

        case 'rotate right':
          setDrivetrain(drivetrain, -1, 1);
          console.log('message: ' + req);
          break;

        case 'backwards':
          setDrivetrain(drivetrain, -1, -1);
          console.log('message: ' + req);
          break;

        case 'rotate left':
          setDrivetrain(drivetrain, 1, -1);
          console.log('message: ' + req);
          break;

        case 'stop':
        default:
          setDrivetrain(drivetrain, 0, 0);
          console.log('message: ' + req);
      }
    });
  });
});

// start listening on port 8080
http.listen(8080, function() {
  console.log('listening on *:8080');
});

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

  const args = ["-w", "640", "-h", "480", "-o", "./stream/image_stream.jpg", "-t", "0", "-tl", "0"];

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