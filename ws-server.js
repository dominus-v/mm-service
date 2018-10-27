const _  = require('underscore'),
    http = require('http'),
    crypto = require('crypto');

var Client = function (args) {
    var self = this;

    self.socket = args.socket;  // Socket field
    self.webSessionId = args.sessionId;
    self.orsSessionId = args.orsSessionId;
};

// Server for handling client sockets: creating, deleting, intercommunication with ORS
var wsServer = function (options) {
    var self = this;

    self.io = options.io;
    self.app = options.app;
    self.nconf = options.nconf;

    self.clients = [];  // Array of client. Client is socket, webSessionId, orsSessionId
    self.sessionMap = new Map();    // Map - webSessionId => orsSessionId

    // Function to initialize socket
    self.init = function() {
        // Fired upon a connection
        self.io.on('connection', function(socket) {
            console.log("WS Client connection. Socket ID: " + socket.id);
            self.handleConnection(socket);
        });
    };

    // Socket handler for an incoming socket
    self.handleConnection = function(socket) {
        // wait for a login message
        socket.on('register', function(data) {
            var webSessionId = data.webSessionId;
            //var badSession = !sessionId || sessionId.length < 3 || sessionId.length > 10;

            // Map short code to ORS session ID
            console.log(self.sessionMap.get(webSessionId));
            var orsSessionId = self.sessionMap.get(webSessionId);

            // Create a new client model
            var newClient = new Client ({
                socket: socket,
                webSessionId: webSessionId,
                orsSessionId: orsSessionId
            });

            // Push to clients array
            self.clients.push(newClient);

            // set response listeners for the new client
            self.setResponseListeners(newClient);

            self.orsRequest(newClient, "gmm.registered", data);

            // send pending message to client
            socket.emit('registered');

            console.log("Session registered: ", webSessionId, " for Socket ID: ", socket.id);
        });
    };

    // method to set response listeners
    self.setResponseListeners = function (client) {
        // triggered when a socket disconnects
        client.socket.on('unregister', function() {
            // remove the client
            self.clients.splice(self.clients.indexOf(client), 1);
            console.log("Session unregistered: " +  client.sessionId);
        });

        // triggered when a socket disconnects
        client.socket.on('disconnect', function() {
            // remove the client
            self.clients.splice(self.clients.indexOf(client), 1);
            console.log("Session ended: " +  client.sessionId);
        });

        // triggered when socket send a message
        client.socket.on('message', function(data) {
            console.log("Client event:" + data);
        });

        // triggered when client sends a select message
        client.socket.on('select', function(data) {
            console.log("Client event:", data);
            self.orsRequest(client, "gmm.select", data);
        });

        // triggered when client sends a select message
        client.socket.on('page.entered', function(data) {
            console.log("Client event:", data);
            self.orsRequest(client, "gmm.page.entered", data);
        });

        // triggered when client sends a select message
        client.socket.on('auth', function(data) {
            console.log("Client event:", data);
            self.orsRequest(client, "gmm.auth", data);
        });

    };

    self.orsRequest = function(client, eventName, jsonPostData) {

        var postData = JSON.stringify(jsonPostData);

        var options = {
            host: self.nconf.get("ors:host"),
            port: self.nconf.get("ors:port"),
            path: self.nconf.get("ors:path"),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        var timeout_wrapper = function( req ) {
            return function( ) {
                // do some logging, cleaning, etc. depending on req
                req.abort();
                try {
                    client.socket.emit('err',{message:'timeout'});
                } catch (emitErr) {
                    console.log("Emit (Timeout) Error: ", emitErr);
                }
            };
        };

        // Create Session URL
        options.path = options.path + "/" + client.orsSessionId + "/event/" + eventName;

        console.log("Going to send ORS event", options);
		console.log(postData);

        var request = http.request(options, function (res) {
            res.on('data', function (data) {
                // reset timeout
                clearTimeout( timeout );
                timeout = setTimeout( fn, self.nconf.get("ors:dataTimeout") );
            }).on('end', function () {
                // clear timeout
                clearTimeout( timeout );

                console.log("ORS Status Code:",res.statusCode);
                console.log("ORS Headers:",res.headers);
                console.log("ORS Body:",res.data);

                if(res && res.statusCode && res.statusCode != 200) {
                    client.socket.emit('err',{message: 'ORS Error', code: res.statusCode});
                }

            }).on('error', function (err) {
                try {
                    // clear timeout
                    clearTimeout( timeout );
                    console.log("Got error: " + err.message);
                    client.socket.emit('err',{message: err.message});
                } catch (emitErr) {
                    console.log("Emit (Request) Error: ", emitErr);
                }
            });
        }).on('error', function(err){
            try {
                clearTimeout( timeout );
                client.socket.emit('err',{message: err.message});
            } catch (emitErr) {
                console.log("Emit (HTTP GET) Error: ", emitErr);
            }
        });

        request.write(postData, (res) => {
			console.log(res);
		});
        request.end((res) => {
			console.log(res);
		});

        // generate timeout handler
        var fn = timeout_wrapper( request );

        // set initial timeout
        var timeout = setTimeout( fn, self.nconf.get("ors:requestTimeout") );

    };

    // Start ORS session with generating web session ID
    self.startOrsSession = function(orsSessionId) {
        //var webSessionId = (Math.floor (Math.random() * 1000000)).toString();
        var webSessionId = crypto.randomBytes(5).toString('hex');

        // push to ORS session array
        self.sessionMap.set(webSessionId, orsSessionId);

        return webSessionId;
    };

    // Stop ORS Session
    self.stopOrsSession = function(orsSessionId) {

        // TODO: Clean up map

        // var shortCode = _.find(self.sessionMap, orsSessionId);

        // var mapEntries = _.filter(self.sessionMap, orsSessionId);
        // var clients = _.where(self.clients, {sessionId: shortCode});

        // _each(clients, function(client) {
        //   dest.socket.emit("end", {reason:'Session removed'});
        //   self.clients.splice(self.clients.indexOf(client), 1);
        // });

        // self.sessionMap.splice(self.sessionMap.indexOf(shortCode), 1);
    };

    self.sendEvent = function(session, req) {
        //var webSessionId = self.sessionMap.get(session);
        console.log('About to send data', session, req);
        var destinations = _.where(self.clients, {orsSessionId: session});

        let event = 'page';

        _.each(destinations, function(dest){
            console.log("Emitting event [" + event + "] to session/socket: " + dest.sessionId + "/" + dest.socket.id);
            dest.socket.emit(event, req);
        });
    };
    /*
    self.queryBuilder = function (content) {
        let contentType = content['contentType'];
        console.log(contentType, 'found');
        let result = '';
        if (contentType === 'question') {
            result = '<div id="query-area"> Вот здесь будет вопрос </div>';
            //
        } else if (contentType === 'announcement') {
            result = '<div id="query-area"> Здесь будет просто сообщение </div>';
            //
        }
        return result;
    }
    */

    self.sendOrsEvent = function(session, event, params) {
        var destinations = _.where(self.clients, {sessionId: session});
        self.orsRequest(destinations[0], event, params);
    }

};

module.exports = wsServer;
