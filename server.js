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

var playTrack = function(req, res) {
    var track = sp.Track.getFromUrl('spotify:track:' + req.params.sid);
    function next() {

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
    };

    if (track.isReady())
        next();
    else
        track.on('ready', next);
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
    var server = http.createServer(app).listen(1337);
}, 100);

app.get('/track/:sid', playTrack);
app.get('/playlists', getPlaylists);
app.get('/playlists/:user/:sid', getPlaylistTracks);

app.use("/", express.static(__dirname + '/pub'));

process.on('uncaughtException', function(err) {
    console.log("Uncaught exception!", err, err.stack);
});
