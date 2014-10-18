var player = document.getElementById('player');
var $player = $(player);

var RickRoll = '6JEK0CvvjDjjMUBFoXShNZ';
var AlanBraxe = '4ao36tgMZ2rYHF9w1i9H04';
var Disclosure = '1snNAXmmPXCn0dkF9DaPWw';
var Creme = '7cksT9fBZRkoaUUWs8kVUQ';

var SERVER = 'http://example.com:1337';

var SyncState = {};
var currentPlaylist = null;
var playlistSidToIndex = null;

function IsNavigatorOnline() {
    //return false;
    return navigator.onLine;
}

function ErrorLocalStorage(msg, err) {
    alert('Local storage error ' + msg + ': ' + err);
    return false;
}

function init() {
    if (IsNavigatorOnline()) {
        console.log('loading playlists from the server');
        $.get(SERVER + '/playlists', function(data) {
            ShowPlaylists(data.pls);
            localforage.setItem('playlists', data.pls, function(err) {
                if (err) {
                    return ErrorLocalStorage('on setItem playlists', err);
                }
            });
            SyncState['playlists'] = true;
        });
    } else if (SyncState['playlists'] === true) {
        console.log('loading playlists from the cache');
        localforage.getItem('playlists', function (err, playlists) {
            if (err) {
                return ErrorLocalStorage('on getItem playlists', err);
            }
            ShowPlaylists(playlists);
        })
    } else {
        alert('no internet connection and no playlists cache');
        return;
    }
}

$(document).foundation();
localforage.keys(function (err, keys) {
    keys.map(function(k) { SyncState[k] = true; });
    init();
});

$tracks = $('#tracks');
function ShowPlaylist(tracks) {
    var html = '';
    tracks.map(function(t) {
        html += '<li><a id="track-' + t.sid + '" href="#">' + t.artist + ' - ' + t.name + '</a></li>';
    });
    $tracks.html(html);

    // Bind click handlers
    tracks.map(function(t) {
        (function(sid) {
            $('#track-' + sid).click(function() {
                changeTrack(sid);
                return false;
            });
        })(t.sid);
    });
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

    var key = 'playlist-' + id;

    if (IsNavigatorOnline()) {
        $.get(SERVER + '/playlists/' + username + '/' + id, function(data) {
            OnLoadedPlaylist(data.tracks);
            localforage.setItem(key, data.tracks, function(err) {
                if (err) {
                    return ErrorLocalStore('on setItem playlist<' + username + '/' + id + '>', err);
                }
            });
            SyncState[key] = true;
        });
    } else if (SyncState[key] === true) {
        console.log('loading playlist from the cache');
        localforage.getItem(key, function(err, tracks) {
            if (err) {
                return ErrorLocalStore('on getItem playlist<' + username + '/' + id + '>', err);
            }
            OnLoadedPlaylist(tracks);
        });
    } else {
        alert('no internet connection and no playlist cache');
        return;
    }
}

$playlists = $('#playlists');
function ShowPlaylists(playlists) {
    var html = '';
    playlists.map(function(pl) {
        html += '<li><a id="playlist-' + pl.playlistId + '" href="#">' + pl.name + '</a> ' +
                '<a id="playlist-sync-' + pl.playlistId + '" href="#">(sync)</a></li>'
    });
    $playlists.html(html);

    // Bind click handlers
    playlists.map(function(pl) {
        (function(username, pid) {
            $('#playlist-' + pid).click(function() {
                onClickPlaylist(username, pid);
                return false;
            });
            $('#playlist-sync-' + pid).click(function() {
                onClickSyncPlaylist(pid);
                return false;
            });
        })(pl.username, pl.playlistId);
    });
}

function changeTrack(sid) {

    var key = 'track-' + sid;

    if (SyncState[key] === true) {
        console.log('loading track from the cache');
        localforage.getItem(key, function(err, data) {
            if (err) {
                return ErrorLocalStorage('on getItem track ' + sid, err);
            }

            try {
                var blob = new Blob([data]);
                var uri = window.URL.createObjectURL(blob);
                player.pause();
                player.src = uri;
                player.play();
            } catch (ex) {
                alert('error when loading cached track: ' + ex);
                return;
            }
        });
    } else if (IsNavigatorOnline()) {
        console.log('loading track from the server');
        player.pause();
        player.src = SERVER + '/track/' + sid;
        player.play();
    } else {
        alert('track ' + sid + ' not cached and no internet connection');
        return;
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

    var key = 'playlist-' + playlistId;

    if (SyncState[key] !== true) {
        alert('playlist ' + key + ' not loaded in the cache');
        return;
    }

    function doNext(tracks) {
        if (tracks.length <= 0) {
            alert('all playlist tracks saved in the cache');
            return;
        }
        var sid = tracks.pop().sid;
        syncLocally(sid, function(err) {
            if (err) {
                alert('track not synced: ' + err)
                return
            }
            doNext(tracks);
        });
    }

    localforage.getItem(key, function(err, tracks) {
        if (err) {
            return ErrorLocalStorage('on getItem playlist ' + key, err);
        }
        doNext(tracks);
    });
}

function syncLocally(sid, cb) {

    var key = 'track-' + sid;

    if (SyncState[key] === true) {
        console.log('Track ' + key + ' already synced locally')
        cb(null);
        return;
    }

    if (!player.paused) {
        alert("As a current limitation, tracks can't be synced when a track is "+
              "playing.");
        // TODO that happens because there's actually only one player on the
        // server. A better multithreaded program would greatly help here.
        player.src = '';
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', SERVER + '/track/' + sid, true);
    xhr.responseType = 'arraybuffer';
    xhr.addEventListener('readystatechange', function() {
        if (xhr.readyState === 4) { // readyState DONE
            if (xhr.response === null || xhr.status !== 200) {
                console.error('track ' + sid + ' not synced: status == ' + xhr.status);
                cb('XHR error: ' + xhr.status + '\nResponse: ' + xhr.response);
            }

            localforage.setItem(key, xhr.response, function(err) {
                if (err) {
                    cb(err);
                    return;
                }
                console.log('track ' + key + ' synced');
            });
            SyncState[key] = true;
            cb(null);
        }
    });
    xhr.send(null);
}

