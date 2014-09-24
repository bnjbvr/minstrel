var sp = require('libspotify');

var fs = require('fs');
var spawn = require('child_process').spawn;

var session = new sp.Session({
    applicationKey: __dirname + '/private/spotify_appkey.key'
});

var cred = require('./private/passwd');
session.login(cred.login, cred.password);

var express = require('express');
var http = require('http');

var app = new express();
var ready = false;

var playing = false;

session.once('login', function(err) {
    if (err) {
        this.emit('error', err);
        return;
    }
    ready = true;
});

var cb = function(req, res) {
    // Always choose your tracks wisely.
    var track = sp.Track.getFromUrl('spotify:track:' + req.params.sid);
    track.on('ready', function() {

        var requestAborted = false;

        // Set up Spotify player
        player = session.getPlayer();
        player.once('track-end', function() {
            console.log('track ended');
            smoothExit();
        });
        player.on('data', function(data) {
            if (requestAborted) {
                return;
            }
            //console.log('passing data to ffmpeg', data.length);
            ffmpeg.stdin.write(data);
        });

        // TODO my guess is that this could be made way simpler with streams,
        // but this was too much error prone.

        // Set up FFMPEG
        var ffmpeg = spawn('avconv', ['-f', 's16le', '-ac', 2, '-ar', '44100', '-i', 'pipe:0', '-f', 'ogg', '-codec:a', 'libvorbis', 'pipe:1']);
        ffmpeg.stdout.on('data', function(data) {
            if (requestAborted) {
                return;
            }
            //console.log('ffmpeg-stdout: chunk received of size ', data.length);
            res.write(data);
        });
        ffmpeg.stderr.on('data', function(data) {
            console.log('ffmpeg-stderr: ' + data);
        });
        ffmpeg.on('close', function(code) {
            console.log('ffmpeg closed with code ', code);
            smoothExit();
        });

        function smoothExit() {
            if (!resClosed) {
                resClosed = true;
                player.stop();
                ffmpeg.kill();
            }
        }

        // Set up request
        var resClosed = false;
        res.on('close', function() {
            requestAborted = true;
            smoothExit();
        });

        player.load(track);
        player.play();
        console.log('playing track');
        res.writeHead(200, {
            'Content-Type': 'audio/ogg'
        });
    });
}

var waitReady = setInterval(function() {
    if (!ready)
        return;

    console.log('ready');
    clearInterval(waitReady);
    var server = http.createServer(app).listen(1337);
}, 100);

app.get('/track/:sid', cb);
app.use("/", express.static(__dirname + '/pub'));

process.on('uncaughtException', function(err) {
    console.log("Uncaught exception!", err, err.stack);
});
