var socket = io();

// event emitter
$('form').submit(function() {
  socket.emit('log message', $('#log-input').val());
  $('#log-input').val('');
  return false;
});

// receive the message
socket.on('log message', function(msg) {
  $('#messages').append($('<li>').text(msg));
  $('#messages').scrollTop($('#messages').height());
  return;
});

// start the stream
// socket.on('liveStream', function(url) {
//   $('#stream').attr('src', url);
//   $('#start-stream').hide();
//   return;
// });

// ----------------------------
// h264 live player
var canvas = document.createElement("canvas");
document.getElementById("stream").appendChild(canvas);

// Create h264 player
const hostname = window.location.hostname;

var uri = `ws://${hostname}:8081`;
var wsavc = new WSAvcPlayer(canvas, "webgl", 1, 35);
wsavc.connect(uri);

//expose instance for button callbacks
window.wsavc = wsavc;

// --------------------------------------
// W A S D controls
// Camera pan and tilt controls
// bind key down event listener to window
window.addEventListener('keydown', (e) => {
  let direction;

  switch(e.key) {
    case "w":
      direction = 'forward';
      break;
    case "a":
      direction = 'rotate left';
      break;
    case "s":
      direction = 'backwards';
      break;
    case "d":
      direction = 'rotate right';
      break;
    case "ArrowUp":
      direction = 'camera up';
      break;
    case "ArrowLeft":
      direction = 'camera left';
      break;
    case "ArrowDown":
      direction = 'camera down';
      break;
    case "ArrowRight":
      direction = 'camera right';
      break;
    case " ":
      direction = 'stop';
      break;
    default:
      break;
  }

  console.log(direction);

  gpio(direction);
  return;
})

function gpio(req) {
  socket.emit('gpio', req);
  return;
}

function startStream() {
  socket.emit('start-stream');
  $('#start-stream').hide();
  return;
}
