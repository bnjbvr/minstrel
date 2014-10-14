var player = document.getElementById('player');
var $player = $(player);

var RickRoll = '6JEK0CvvjDjjMUBFoXShNZ';
var AlanBraxe = '4ao36tgMZ2rYHF9w1i9H04';
var Disclosure = '1snNAXmmPXCn0dkF9DaPWw';

var currentPlaylist = null;
var playlistSidToIndex = null;

$tracks = $('#tracks');
function onClickPlaylist(username, id) {
    $.get('/playlists/' + username + '/' + id, function(data) {

        currentPlaylist = [];
        playlistSidToIndex = {};
        for (var i = 0; i < data.num; i++) {
            var t = data.tracks[i];
            currentPlaylist.push(t.sid);
            playlistSidToIndex[t.sid] = i;
        }

        // What to show
        var html = '';
        for (var i = 0; i < data.num; i++) {
            var t = data.tracks[i];
            html += '<li><a href="#" onclick="changeTrack(\'' + t.sid + '\'); return false">' +
                t.artist + ' - ' + t.name + '</a></li>';
        }
        $tracks.html(html);
    });
}

$playlists = $('#playlists');
$.get('/playlists', function(data) {
    var html = '';
    for (var i = 0; i < data.pls.length; i++) {
        var pl = data.pls[i];
        html += '<li><a href="#" onclick="onClickPlaylist(\'' + pl.username + '\', \'' + pl.playlistId +
                    '\'); return false;">' + pl.name + '</a></li>'
    }
    $playlists.html(html);
});

function changeTrack(sid) {
    player.pause();
    player.src = '/track/' + sid;
    player.play();

    // Repeat mode
    player.onended = function() {
        if (currentPlaylist === null)
            return;
        var l = currentPlaylist.length;
        var nextIndex = (playlistSidToIndex[sid] + 1) % l;
        changeTrack(currentPlaylist[nextIndex]);
    };
}

changeTrack(RickRoll);

