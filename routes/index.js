var _          = require('underscore');
var gameboard  = require('./gameboard');
var express    = require('express');
var router     = express.Router();

/*
 Handle POST request to '/start'

{
   you: '76b6ae04-71bd-4d3d-8a94-96b06290932b',
   width: 30,
   turn: 0,
   snakes:
    [ { taunt: 'Oh my gosh',
        name: 'nake',
        id: 'b2468470-f846-4bcf-abdc-2520359c3710',
        health_points: 100,
        coords: [Object] },
      { taunt: 'Let\'s do thisss thang!',
        name: 'FriskySnake',
        id: '76b6ae04-71bd-4d3d-8a94-96b06290932b',
        health_points: 100,
        coords: [Object] },
      { taunt: 'Choke yourself!',
        name: 'FriskyDingo',
        id: '9954806c-aaf3-4cad-aa03-db290561a3b1',
        health_points: 100,
        coords: [Object] } ],
   height: 30,
   game_id: 'ef599476-8be1-4f1b-bb37-0d1c4f96eace',
   food: [ [ 0, 29 ] ],
   dead_snakes: []
}
*/
router.post('/start', function (req, res) {
    // NOTE: Do something here to start the game
    if (!req.body) return res.sendStatus(400)

    // record game state
    var grid = gameboard.initGame(req.body);

    // Response data
    var data = {
      color: "#4A0000",
      secondary_color: "#007F96",
      name: "FriskySnake",
      head_url: "http://www.blogcdn.com/www.aoltv.com/media/2007/04/fdrisksyss.gif",
      taunt: "Let's do thisss thang!",
      head_type: "fang",
      tail_type: "curled"
    }

    return res.json(data)
});

router.post('/end', function (req, res) {
    // Response data
    var data = {
      taunt: 'Outta my way, snake!'
    }

    return res.json(data)
});

/**
 Handle POST request to '/move'

{
   game_id: 'ef599476-8be1-4f1b-bb37-0d1c4f96eace',
   you: '76b6ae04-71bd-4d3d-8a94-96b06290932b',
   width: 30,
   height: 30,
   turn: 0,
   snakes:
    [ { taunt: 'Oh my gosh',
        name: 'Snakito',
        id: 'b2468470-f846-4bcf-abdc-2520359c3710',
        health_points: 100,
        coords: [[1,2]] },
      { taunt: 'Let\'s do thisss thang!',
        name: 'FriskySnake',
        id: '76b6ae04-71bd-4d3d-8a94-96b06290932b',
        health_points: 100,
        coords: [[3,4]] },
      { taunt: 'Choke yourself!',
        name: 'FriskyDingo',
        id: '9954806c-aaf3-4cad-aa03-db290561a3b1',
        health_points: 100,
        coords: [[8,9]] }
    ],
   food: [ [ 0, 29 ] ],
   dead_snakes: []
}
*/
router.post('/move', function (req, res) {
    //console.log(req.body);

    if (!req.body) return res.sendStatus(400);

    var gameId = req.body['game_id'];
    var nextDirection = gameboard.newMove(req.body);
    //console.log(nextDirection);
    var anotherTaunt = gameboard.nextTaunt(gameId);

    // Response data
    var data = {
        move: nextDirection,
        taunt: anotherTaunt
    }

    return res.json(data);
});

module.exports = router;
