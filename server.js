const mongo = require('mongodb').MongoClient;
const express = require('express');
const app = express();
const https = require('https');
const fs = require('fs');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const config = require('./config');

app.use(express.static('./static'));
app.use(bodyParser.json());

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

app.use('/push', (req, res) => {
	subs.push(req.body);
	res.status(201).json({});
	webpush.sendNotification(req.body.subscription, JSON.stringify({name: 'Meaw Meaw', message: 'Web Push registered!'}))
	.catch(err => console.error(err));
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