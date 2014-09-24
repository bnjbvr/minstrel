var player = document.getElementById('player');
var $player = $(player);

var RickRoll = '6JEK0CvvjDjjMUBFoXShNZ';
var AlanBraxe = '4ao36tgMZ2rYHF9w1i9H04';
var Disclosure = '1snNAXmmPXCn0dkF9DaPWw';

function changeTrack(sid) {
    player.pause();
    player.src = '/track/' + sid;
    player.play();
}

$('#t1').click(function() {
    changeTrack(AlanBraxe);
});
$('#t2').click(function() {
    changeTrack(Disclosure);
});
$('#t3').click(function() {
    changeTrack(RickRoll);
});
changeTrack(AlanBraxe);
