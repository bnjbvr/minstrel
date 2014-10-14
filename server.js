// Imports
var sp = require('libspotify');

var fs = require('fs');
var spawn = require('child_process').spawn;

var express = require('express');
var http = require('http');

// Constants
var PORT = process.env.PORT || 1337;

// THE CODE
var session = new sp.Session({
    applicationKey: __dirname + '/private/spotify_appkey.key'
});

var cred = require('./private/passwd');
session.login(cred.login, cred.password);

var app = new express();
var ready = false;

session.once('login', function(err) {
    if (err) {
        this.emit('error', err);
        return;
    }
    ready = true;
});

var playTrack = function(req, res) {

    function ffmpeg() {
        return spawn('avconv',
                     ['-f', 's16le', '-ac', 2, '-ar', '44100', '-i', 'pipe:0',
                      '-f', 'ogg', '-codec:a', 'libvorbis', 'pipe:1']);
    }

    var track = sp.Track.getFromUrl('spotify:track:' + req.params.sid);

    function next() {

        // TODO my guess is that this could be made way simpler with streams,
        // but this was too much error prone.
        //
        var requestAborted = false;

        // Set up Spotify player
        var player = session.getPlayer();

        function playercb(data) {
            F.stdin.write(data);
        }

        player.on('data', playercb);

        player.once('track-end', function() {
            console.log('track ended');

            // Remove elements in their reverse order in the stream
            player.removeListener('data', playercb);
            F.stdin.end();
        });

        // Set up FFMPEG
        var F = ffmpeg();

        F.stdout.on('data', function(data) {
            res.write(data);
        });

        F.stderr.on('data', function(data) {
            console.log('ffmpeg-stderr: ' + data);
        });

        F.on('close', function(code) {
            console.log('ffmpeg closed with code ', code);
            if (!requestAborted) {
                res.end();
            }
        });

        // Set up request
        res.on('close', function() {
            console.log('request aborted');
            requestAborted = true;

            // Remove elements in their reverse order in the stream
            player.removeListener('data', playercb);
            F.stdin.end();

            player.stop();
        });

        console.log('playing track');
        player.load(track);
        player.play();

        res.writeHead(200, {
            'Content-Type': 'audio/ogg'
        });
    };

    if (track.isReady()) {
        next();
    } else {
        track.on('ready', next);
    }
}

function getPlaylists(req, res) {
    var container = session.getPlaylistcontainer();
    var ret = {};
    container.getPlaylists(function(pls) {
        ret.num = pls.length;
        ret.pls = [];
        for (var i = 0; i < pls.length; i++) {
            // spotify:user:$username:playlist:$playlistId
            var split = pls[i].getUrl().split(':');

            var username = split[2];
            var playlistId = split[4];

            ret.pls.push({
                name: pls[i].name,
                numSubscribers: pls[i].numSubscribers,
                playlistId: playlistId,
                username: username
            });
        }
        res.json(ret);
    });
}

function getPlaylistTracks(req, res) {

    function next(playlist) {
        playlist.getTracks(function(tracks) {
            var ret = {};
            ret.num = tracks.length;
            ret.tracks = [];
            for (var i = 0; i < ret.num; i++) {
                var t = tracks[i];
                ret.tracks.push({
                    duration: t.duration,
                    humanDuration: t.humanDuration,
                    name: t.name,
                    artist: t.artist.name,
                    available: t.isAvailable(),
                    sid: t.getUrl().split(':')[2]
                });
            }
            res.json(ret);
        });
    }

    var pl = sp.Playlist.getFromUrl('spotify:user:' + req.params.user + ':playlist:' + req.params.sid);

    if (pl.isReady()) {
        next(pl);
    } else {
        pl.on('ready', function() {
            next(pl);
        });
    }
}

var waitReady = setInterval(function() {
    if (!ready)
        return;

    // Initializes the http server only once the session is ready
    console.log('ready');
    clearInterval(waitReady);
    var server = http.createServer(app).listen(PORT);
}, 100);

app.get('/track/:sid', playTrack);
app.get('/playlists', getPlaylists);
app.get('/playlists/:user/:sid', getPlaylistTracks);

app.use("/", express.static(__dirname + '/pub'));

process.on('uncaughtException', function(err) {
    console.log("Uncaught exception!", err, err.stack);
});
