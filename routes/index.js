var _       = require('underscore');
var astar   = require('./astar');
var express = require('express');
var router  = express.Router();

// Grid Weights
var GOLD   = 5;  // Most Important
var FOOD   = 3;  // Important
var SAFTEY = 1;  // Safe path
var SNAKE  = 0;  // Avoid
var WALL   = 0;  // Avoid

var MY_NAME = 'FriskySnake';

// Previous Game state
var gameState = {};

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
    //console.log(req.body)

    // NOTE: Do something here to start the game
    if (!req.body) return res.sendStatus(400)

    // record game state
    gameState[req.body.game_id] = {"middle": {"x":(req.body.width/2), "y":(req.body.height/2)}};

    // Response data
    var data = {
      color: "#DDFF00",
      secondary_color: "#00D5FB",
      name: "FriskySnake",
      head_url: "http://www.blogcdn.com/www.aoltv.com/media/2007/04/fdrisksyss.gif",
      taunt: "Let's do thisss thang!",
      head_type: "tongue",
      tail_type: "freckled"
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
        name: 'nake',
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
    console.log(req.body);

    if (!req.body) return res.sendStatus(400);

    var gameId = req.body['game_id'];
    var snakes = req.body['snakes'];
    var food = req.body['food'];

    console.log("*** GAME STATE ***");
    console.log(gameState[gameId]);

    //console.log(snakes);
    //console.log(food);
    //console.log("*** using underscore *** ");
    // find our snake
    var mysnek = _.find(snakes, function(snake) { return snake.name == MY_NAME; });
    //console.log("*** my snek *** ");
    //console.log(mysnek);
    var mysnek_head = mysnek.coords[0];
    var mysnek_coords = mysnek.coords;

    // initialize the grid
    var grid = init(mysnek, req.body);
    //console.log("*** The Grid *** ");
    //console.log(grid);

    // search for shortest path to food
    //console.log("*** food check start *** ");
    var path;
    var tentatives = new Array();
    food.forEach(function(pellet) {
       var tentative = astar.search(grid, mysnek_head, pellet);
        if (!tentative) {
            console.log("**** no path to food pellet");
            return;
        }

        // save this for later
        tentatives.push(tentative);

        // check that there are no other snake heads closer
        var path_length = _.size(tentative);
        var mysnek_length = _.size(mysnek_coords) + 1;
        var dead = false;
        snakes.forEach(function(enemy) {
            if (enemy.name == MY_NAME)
                return;
            if (path_length >= distance(enemy['coords'][0], pellet))
                dead = true;
        })
        if (dead)
            return;

        path = tentative;
    })
    //console.log("***food check complete *** ")

    // if there are no paths to food pellets then head to the middle or chase our tail
    var despair = false;
    if (!path) {
        console.log('no path to our tail so lets head for the middle');
        path = astar.search(grid, mysnek_head, gameState[gameId].middle);
    }
    if (!path) {
        console.log('no path to any food so lets chase our tail');
        path = astar.search(grid, mysnek_head, mysnek_coords[mysnek_coords.length-1]);
        despair = !path || !(_.size(path) > 1);
    }

    // if there's no path to our tail or the middle of the board then we should pick the first safest location
    if (despair) {
        console.log('*** DESPAIR: NO PATH');
        // if there are no paths to food pellets closest to us, pick the second closest anyway
        if (_.size(tentatives) > 1) {
            console.log("*** picking the second closest pellet to us *** ");
            path = tentatives[1];
        } else if (_.size(tentatives) > 0) {
            console.log("*** picking the closest pellet to us *** ");
            path = tentatives[0];
        } else {
            // if there are no potential food pellets then pick the first safest location
            path = [ safestNeighbour(mysnek_head, grid) ];
        }
    }

    console.log('######## THE CHOSEN PATH ##########');
    console.log('next coord: x='+ path[0].x +', y='+path[0].y);

    var nextDirection = direction(mysnek_head, [path[0].x, path[0].y]);
    console.log(nextDirection);

    // record the move for next time
    gameState[gameId] = _.extend(gameState[gameId], {"move": nextDirection});
    // Response data
    var data = {
        move: nextDirection,
        taunt: 'I am Killface!'
    }

    return res.json(data);
});

function init(mysnek, data) {
    var snakes = data.snakes;
    var food = data.food;

    var grid = matrix(data.height, data.width, SAFTEY);

    if (snakes.length) {
        snakes.forEach(function(snek) {
          snek['coords'].forEach(function(coord) {
            grid[coord[0]][coord[1]] = SNAKE;
          })
        })
    }
    if (food.length) {
        //console.log(food)
        food.forEach(function(f) {
            grid[f[0]][f[1]] = FOOD;
        })
    }
    if (data['mode'] == 'advanced') {
      var walls = data.walls;
      if (walls.length) {
          walls.forEach(function(w) {
              grid[w[0]][w[1]] = WALL;
          });
      }
      var gold = data.walls;
      if (gold.length) {
          gold.forEach(function(g) {
              grid[g[0]][g[1]] = GOLD;
          });
      }
    }

    return grid;
}

/**
 * Distance between two coordinates in a matrix:
 *   [1,1] and [2,2]
 */
function distance(p, q) {
    var dx = Math.abs(p[0] - q[0]);
    var dy = Math.abs(p[1] - q[1]);
    return dx + dy;
}

function direction(from_cell, to_cell) {
    var dx = to_cell[0] - from_cell[0];
    var dy = to_cell[1] - from_cell[1];

    if (dx == 1)
        return 'right'
    else if (dx == -1)
        return 'left'
    else if (dy == -1)
        return 'up'

    return 'down'
}

function matrix(rows, cols, defaultValue) {
    var arr = new Array(rows);
    for(var i=0; i < rows; i++){
        // Adds cols to the empty line:
        arr[i] = new Array(cols);
        for(var j=0; j < cols; j++){
          // Initializes:
          arr[i][j] = defaultValue;
        }
    }
    return arr;
}

function safestNeighbour(head, grid) {
    var ret = [];
    var x = head[0];
    var y = head[1];
    var grid = this.grid;

    // Check West
    if (grid[x - 1] && grid[x - 1][y]) {
        return {"x":(x-1), "y":y };
    }

    // Check East
    if (grid[x + 1] && grid[x + 1][y]) {
        return {"x":(x+1), "y":y };
    }

    // Check South
    if (grid[x] && grid[x][y - 1]) {
        return {"x":x, "y":(y-1) };
    }

    // Check North
    if (grid[x] && grid[x][y + 1]) {
        return {"x":x, "y":(y+1) };
    }

    // this will cause a down action
    return head;
}

function closest(items, start) {
    var closest_item = _.min(items, function(item) {
        return distance(start, item);
    });

    return closest_item
}

/* Other functions that could help improve snake behaviour

ifFoodAhead: If there is food in line with the snake’s current direction, this function will execute its first argument, otherwise it will execute the second argument. This was the only initial function that gave the snake information beyond its immediate surroundings.
function ifFoodAhead(grid, snake) {
}

ifDangerAhead: If the game square immediately in front of the snake is occupied with either a snake body segment or the wall, this function will execute its first argument, otherwise it will execute its second argument.
function ifDangerAhead(grid, snake) {
}

ifDangerRight: If the game square immediately to the right of the snake is occupied with either a snake body segment or the wall, this function will execute its first argument, otherwise it will execute its second argument.
function ifDangerRight(grid, snake) {
}

ifDangerLeft: If the game square immediately to the left of the snake is occupied with either a snake body segment or the wall, this function will execute its first argument, otherwise it will execute its second argument.
function ifDangerLeft(grid, snake) {
}

progn2: This is a connectivity function that will first execute its right argument, then its left. It is the only function that allows execution of more than one terminal in a single parse of the function tree
function progn2(move, move) {
}

ifDangerTwoAhead: If the game square two spaces immediately in front of the snake is occupied by either the wall or a segment of the snake’s body, this function will execute the first parameter, otherwise it will execute the second.
function ifDangerTwoAhead(grid, snake) {
}

ifFoodUp: If the current piece of food on the board is closer to the top of the game board than the snake’s head, then the first parameter of this function will be executed, otherwise the second parameter will be executed.
function ifFoodUp(grid, snake) {
}

ifFoodRight: If the current piece of food on the board is further to the right of the game board than the snake’s head, then the first parameter of this function will be executed, otherwise the second parameter will be executed.
function ifFoodRight(grid, snake) {
}

ifMovingRight: If the snake is moving right, then the first parameter of this function will be executed, otherwise the second parameter will be executed.
function ifMovingRight(grid, snake) {
}

ifMovingLeft: If the snake is moving left, then the first parameter of this function will be executed, otherwise the second parameter will be executed.
function ifMovingLeft(grid, snake) {
}

ifMovingUp: If the snake is moving upward, then the first parameter of this function will be executed, otherwise the second parameter will be executed.
function ifMovingUp(grid, snake) {
}

ifMovingDown: If the snake is moving downward, then the first parameter of this function will be executed, otherwise the second parameter will be executed.
function ifMovingDown(grid, snake) {
}
*/

module.exports = router;
