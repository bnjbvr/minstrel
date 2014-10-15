var player = document.getElementById('player');
var $player = $(player);

var RickRoll = '6JEK0CvvjDjjMUBFoXShNZ';
var AlanBraxe = '4ao36tgMZ2rYHF9w1i9H04';
var Disclosure = '1snNAXmmPXCn0dkF9DaPWw';
var Creme = '7cksT9fBZRkoaUUWs8kVUQ';

var SyncState = {};
var currentPlaylist = null;
var playlistSidToIndex = null;

function IsNavigatorOnline() {
    //return false;
    return navigator.onLine;
}

function init() {
    changeTrack(RickRoll);

    if (IsNavigatorOnline()) {
        console.log('loading playlists from the server');
        $.get('/playlists', function(data) {
            ShowPlaylists(data.pls);
            localforage.setItem('playlists', data.pls);
            SyncState['playlists'] = true;
        });
    } else if (SyncState['playlists'] === true) {
        console.log('loading playlists from the cache');
        localforage.getItem('playlists', function (err, playlists) {
            ShowPlaylists(playlists);
        })
    } else {
        console.log('no internet connection and no playlists cache');
    }
}

localforage.keys(function (err, keys) {
    for (var i = 0; i < keys.length; i++) {
        SyncState[keys[i]] = true;
    }
    init();
});

$tracks = $('#tracks');
function ShowPlaylist(tracks) {
    var html = '';
    for (var i = 0; i < tracks.length; i++) {
        var t = tracks[i];
        html += '<li><a href="#" onclick="changeTrack(\'' + t.sid + '\'); return false">' +
            t.artist + ' - ' + t.name + '</a></li>';
    }
    $tracks.html(html);
}

function OnLoadedPlaylist(tracks) {
    ShowPlaylist(tracks);

    currentPlaylist = [];
    playlistSidToIndex = {};
    for (var i = 0; i < tracks.length; i++) {
        var t = tracks[i];
        currentPlaylist.push(t.sid);
        playlistSidToIndex[t.sid] = i;
    }
}

function onClickPlaylist(username, id) {

    function key() {
        return 'playlist-' + id;
    }

    if (IsNavigatorOnline()) {
        $.get('/playlists/' + username + '/' + id, function(data) {
            OnLoadedPlaylist(data.tracks);
            localforage.setItem(key(), data.tracks);
            SyncState[key()] = true;
        });
    } else if (SyncState[key()] === true) {
        console.log('loading playlist from the cache');
        localforage.getItem(key(), function(err, tracks) {
            OnLoadedPlaylist(tracks);
        });
    } else {
        console.log('no internet connection and no playlist cache');
    }
}

$playlists = $('#playlists');
function ShowPlaylists(playlists) {
    var html = '';
    for (var i = 0; i < playlists.length; i++) {
        var pl = playlists[i];
        html += '<li><a href="#" onclick="onClickPlaylist(\'' + pl.username + '\', \'' + pl.playlistId +
                    '\'); return false;">' + pl.name + '</a> ' +
                '<a href="#" onclick="onClickSyncPlaylist(\'' + pl.playlistId + '\'); return false;">(sync)</a></li>'
    }
    $playlists.html(html);
}

function changeTrack(sid) {

    function key() {
        return 'track-' + sid;
    }

    if (IsNavigatorOnline()) {
        console.log('loading track from the server');
        player.pause();
        player.src = '/track/' + sid;
        player.play();
    } else if (SyncState[key()] === true) {
        console.log('loading track from the cache');
        localforage.getItem(key(), function(err, data) {
            var blob = new Blob([data]);
            var uri = window.URL.createObjectURL(blob);
            player.pause();
            player.src = uri;
            player.play();
        });
    } else {
        console.log('track not cached and no internet connection');
    }

    // Repeat mode
    player.onended = function() {
        if (currentPlaylist === null)
            return;
        var l = currentPlaylist.length;
        var nextIndex = (playlistSidToIndex[sid] + 1) % l;
        changeTrack(currentPlaylist[nextIndex]);
    };
}

function onClickSyncPlaylist(playlistId) {

    function key() {
        return 'playlist-' + playlistId;
    }

    if (SyncState[key()] !== true) {
        console.log(key());
        console.log(Object.keys(SyncState));
        alert('playlist not loaded in the cache');
        return;
    }

    function doNext(tracks) {
        if (tracks.length <= 0) {
            alert('all playlist tracks saved in the cache');
            return;
        }
        var sid = tracks.pop().sid;
        syncLocally(sid, function() {
            doNext(tracks);
        });
    }

    localforage.getItem(key(), function(err, tracks) {
        doNext(tracks);
    });
}

function syncLocally(sid, cb) {

    function key() {
        return 'track-' + sid;
    }

    if (SyncState[key()] === true)
        return;

    if (!player.paused) {
        alert("As a current limitation, tracks can't be synced when a track is "+
              "playing.");
        // TODO that happens because there's actually only one player on the
        // server. A better multithreaded program would greatly help here.
        player.src = '';
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/track/' + sid, true);
    xhr.responseType = 'arraybuffer';
    xhr.addEventListener('readystatechange', function() {
        if (xhr.readyState === 4) { // readyState DONE
            console.log('track ' + sid + ' synced');
            localforage.setItem(key(), xhr.response);
            SyncState[key()] = true;
            cb();
        }
    });
    xhr.send(null);
}

