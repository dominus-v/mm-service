const express   = require('express'),
    http        = require('http'),
    socketio    = require('socket.io'),
    nconf       = require('nconf');
    //stripBom    = require('strip-bom');
    //path        = require('path');
    //morgan  = require('morgan');

// Load Web Socket Server
const wsServer = require("./ws-server");

var gmmServer = function () {

    nconf.argv().env(); // read commandline arguments and environment variables
    nconf.file({file: 'config.json'});  // load configuration from the file

    var port = nconf.get('http:port');

    var app = express();

    //app.use(morgan('[:date] :method :url - :response-time'));
    app.use(express.static(__dirname + "/public"));
    app.use(express.json());
    app.set('view engine', 'ejs');

    var server = http.createServer(app);
    var io = socketio.listen(server);
    server.listen(port);

    var wsOptions = {
        io: io,
        app: app,
        nconf: nconf
    };

    var bridge = new wsServer(wsOptions);
    bridge.init();

    app.get('/', function (req, res) {
        res.render('index');
    });

    app.get('/sample', (req, res) => {
        res.sendFile(__dirname + '/sample.html');
    });

    app.get('/sample1', (req, res) => {
        res.sendFile(__dirname + '/sample1.html');
    });

    app.get('/survey', (req, res) => {
        res.render('survey');
    });

    app.get('/survey/:id', (req, res) => {
        //res.render('survey', {webSessionId: req.params.id});
        //var webSessionId = stripBom(req.params.id);
        console.log('rendering survey for', req.params.id);
        res.render('survey');
    });

    // Start ORS Session
    app.post('/api/v1/start', function (req, res, next) {
        console.log("===== Start ORS Session =====");
        console.log("Headers", req.headers);

        var orsSessionId = req.headers['x-ors-sessionid'];
        var webSessionId = bridge.startOrsSession(orsSessionId);

        console.log("ORS SessionId: ", orsSessionId, "WEB SessionId:", webSessionId);

        res.header('Content-Type', 'application/json');
        var URL = nconf.get('http:URL') + ':' + nconf.get('http:port') + '/survey/' + webSessionId;
        res.json({
            success: '1',
            webSessionID: webSessionId,
            webLink: URL
        });
        next();
    });

    // Stop ORS Session
    app.post('/api/v1/stop', function (req, res, next) {
        console.log("===== Stop ORS Session =====");
        console.log("Headers", req.headers);

        var orsSessionId = req.headers['x-ors-sessionid'];
        var webSessionId = bridge.stopOrsSession(orsSessionId);

        console.log("ORS SessionId: ", orsSessionId, "WEB SessionId:", webSessionId);

        res.header('Content-Type', 'application/json');
        res.json({success: '1'});
        next();
    });

    // ORS Event handler
    //app.post('/api/v1/event/:session', function (req, res, next) {
    app.post('/api/v1/event', function (req, res, next) {
        console.log("===== ORS Event =====");
        console.log("Headers", req.headers);
        console.log("Params", req.params);
        console.log("Body", req.body);

        var orsSessionId = req.headers['x-ors-sessionid'];
        bridge.sendEvent(orsSessionId, req.body);
        //bridge.sendEvent(req.params.session, req.body.event, req.body);

        res.header('Content-Type', 'application/json');
        res.json({success: '1'});
        next();
    });

    // TODO: Currently purpose of this route is not obvious
    /*
    app.post('/api/v1/orsevent/:session', function (req, res, next) {
        res.header('Content-Type', 'application/json');

        console.log("\n>>>");
        console.log("ORS Client Notify Event");
        console.log("Headers", req.headers);
        console.log("Params", req.params);
        console.log("Body", req.body);
        console.log("\n");

        bridge.sendOrsEvent(req.params.session, req.body.event, req.body);
        res.json({response: 'done'});
        next();
    });
    */

    console.log("\n =============== Multi Modal Survey Server is running at " + port + " ===============\n");
};

new gmmServer();
