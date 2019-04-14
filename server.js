const mongo = require('mongodb').MongoClient;
const express = require('express');
const app = express();
const https = require('https');
const fs = require('fs');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const config = require('./config');

app.all('*', (req, res, next) => {
    if (req.secure) {
        return next();
    }
    else {
        res.redirect(307, 'https://' + req.hostname + ':' + 443 + req.url);
    }
});

app.use(express.static('./static'));
app.use(bodyParser.json());
app.use(cookieParser(config.cookieSecret));

var subs = [];

webpush.setVapidDetails('mailto:malolan98@gmail.com', config.publicVapidKey, config.privateVapidKey);

app.get('/.well-known/acme-challenge/3tgO1WLhrgOICpIfOS1W9domFNkQsaGTZYFJJ9sbGv4', function(req, res) {
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');
	fs.readFile(__dirname+"/static/.well-known/acme-challenge/3tgO1WLhrgOICpIfOS1W9domFNkQsaGTZYFJJ9sbGv4", (err, data) => {
		res.end(data);
	});
});
app.get('/.well-known/acme-challenge/N_ywQDCSJPjxoLh0jnGI0MPf-j4KSC3LdXHXL1fgfgY', function(req, res) {
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');
	fs.readFile(__dirname+"/static/.well-known/acme-challenge/N_ywQDCSJPjxoLh0jnGI0MPf-j4KSC3LdXHXL1fgfgY", (err, data) => {
		res.end(data);
	});
});

app.get('/login', (req, res) => {
    res.sendFile(__dirname+'/static/login.html');
});

app.get('/logout', (req, res) => {
    for(var i = 0; i < subs.length; i++) {
        if(subs[i].uname == req.signedCookies.user) {
            subs.splice(i, 1);
        }
    }
    res.status(200).clearCookie('user').json({});
});

app.use('/push', (req, res) => {
    if(!req.body) {
        res.status(400).redirect('/');
    }
    var exists = false;
    for(var i = 0; i < subs.length; i++) {
        if(subs[i].subscription.keys.p256dh == req.body.keys.p256dh) {
            exists = true;
        }
    }
    if(exists) {
        res.status(400).json({});
    } else {
        subs.push({uname: req.signedCookies.user, subscription: req.body});
        res.status(201).json({});
        webpush.sendNotification(req.body, JSON.stringify({name: 'Meaw Meaw', message: 'Web Push registered!'}))
        .catch(err => console.error(err));
    }
    console.log(subs);
});

app.post('/login', (req, res) => {
    db = app.get('db');
    db.collection('users').findOne({user: req.body.uname})
    .then((users) => {
        if(!users) {
            return res.status(400).json({success: false});
        }
        if(users.password == req.body.password) {
            res.statusCode = 200;
            var num = 0;
            for(var i = 0; i < subs.length; i++) {
                if(subs[i].uname == req.body.uname) {
                    num++;
                }
            }
            res.cookie('user', req.body.uname+num, {signed: true, maxAge: 2592000000});
            res.json({success: true});
        }
    });
});

app.get('/un', (req, res) => {
    if(!req.signedCookies.user) {
        return res.status(403).json({success: false, msg: 'Please login first'});
    }
    res.status(200).json({success: true, user: req.signedCookies.user});
});

var options = {
	key: fs.readFileSync(__dirname+'/private.key'),
	cert: fs.readFileSync(__dirname+'/certificate.crt')
};

var secureServer = https.createServer(options, app);

const client = require('socket.io')(secureServer).sockets;

secureServer.listen(443);

app.listen(80);

// Connect to mongo
mongo.connect('mongodb://127.0.0.1/mongochat', function(err, db){
    if(err){
        throw err;
    }

    console.log('MongoDB connected...');

    app.set('db', db);

    // Connect to Socket.io
    client.on('connection', function(socket){
        let chat = db.collection('chats');

        // Create function to send status
        sendStatus = function(s){
            socket.emit('status', s);
        }

        // Get chats from mongo collection
        chat.find().limit(100).sort({_id:1}).toArray(function(err, res){
            if(err){
                throw err;
            }

            // Emit the messages
            socket.emit('output', res);
        });

        // Handle input events
        socket.on('input', function(data){
            let name = data.name;
            let message = data.message;

            // Check for name and message
            if(name == '' || message == ''){
                // Send error status
                sendStatus('Please enter a name and message');
            } else {
                // Insert message
                data.dt = new Date();
                chat.insert({name: name, message: message, dt: data.dt}, function(){
					const pushPayload = JSON.stringify(data);

					subs.forEach((sub) => {
						console.log(sub);
						if(sub.uname != data.name) {
							webpush.sendNotification(sub.subscription, pushPayload)
							.catch((err) => console.error(err));
						}
					});

                    client.emit('output', [data]);

                    // Send status object
                    sendStatus({
                        message: 'Message sent',
                        clear: true
                    });
                });
            }
        });

        // Handle clear
        socket.on('clear', function(data){
            // Remove all chats from collection
            chat.remove({}, function(){
                // Emit cleared
                socket.emit('cleared');
            });
        });
    });
});