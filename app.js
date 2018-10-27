const express = require('express'),
      http = require('http'),
      socket = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socket(server);

//var connCounter = 0;
//var clients = [];
var mapOrsToWeb = new Map();
var mapWebToOrs = new Map();
var mapWebToSock = new Map();

app.use(express.static("public"));
app.set('view engine', 'ejs');

// Express router
// For client application
app.get('/', function (req, res) {
    res.render('home');
});

app.get('/#/:sessionId', function (req, res) {
    res.render('home');
});

// Start ORS session
app.post('/api/v1/session/start', function (req, res, next) {
    console.log('=== Start ORS Session ===');
    console.log('Headers', req.headers);

    // Create web-session id for unique web-link and get orsSessionId
    var webSessionId = Math.floor(Math.random()*1000000);
    var orsSessionId = req.headers['x-ors-sessionid'];

    // Add KV pairs in separate map objects for convenient search by orsSessionId or webCodeId
    mapOrsToWeb.set(orsSessionId, webSessionId);
    mapWebToOrs.set(webSessionId, orsSessionId);

    res.header('Content-Type', 'application/json');
    res.json({response: 'done', webSessionId: webSessionId});
    console.log('Maps after start ORS session:');
    console.log(mapOrsToWeb);
    console.log(mapWebToOrs);
    next();
});

// End ORS session
app.post('/api/v1/session/end', function (req, res, next) {
    console.log('=== End ORS Session ===');
    console.log('Headers', req.headers);

    // Create web-session id for unique web-link and get orsSessionId
    var orsSessionId = req.headers['x-ors-sessionid'];
    var webSessionId = mapOrsToWeb.get(orsSessionId);

    // Delete KV pairs from different map objects
    mapOrsToWeb.delete(orsSessionId);
    mapWebToOrs.delete(webSessionId);

    res.header('Content-Type', 'application/json');
    res.json({response: 'done'});
    console.log('Maps after end ORS session:');
    console.log(mapOrsToWeb);
    console.log(mapWebToOrs);
    next();
});

// ORS Notify Event
app.post('/api/v1/event', function (req, res, next) {
    console.log('=== ORS Event ===');
    console.log('Headers', req.headers);

    // TODO: correct x-ors-question to actual header attribute name
    var orsQuestion = req.headers['x-ors-question'];
    var orsSessionId = req.headers['x-ors-sessionid'];
    var webSessionId = mapOrsToWeb.get(orsSessionId);
    console.log('Found webSessionId: ' + webSessionId);
    var socket = mapWebToSock.get(webSessionId);
    //console.log(typeof (socket));
    socket.emit('message', {'msg': orsQuestion});
    //(mapWebToSock.get(webSessionId)).emit('message', {'msg': orsQuestion});

    res.header('Content-Type', 'application/json');
    res.json({response: 'done'});
    next();
});

// Socket handler
io.on('connection', function (socket) {
    console.log('User connected. SocketID: ' + socket.id);

    // Fired upon 'register' message
    socket.on('register', function (msg) {
        mapWebToSock.set(msg.sessionId, socket);
        console.log('Mapped: ' + msg.sessionId + '/' + socket.id);
        console.log('mapWebToSock looks like: \n' + mapWebToOrs);
    });

    //
    socket.on('message', function (msg) {
        io.emit('message', msg);
        console.log('message: ' + msg);
    });

    socket.on('disconnect', function (msg){
        console.log('User disconnected. SocketID: ' + socket.id);
    });
});

process.env.PORT = 80;
server.listen(process.env.PORT, function () {
    console.log('Server started ...');
});
