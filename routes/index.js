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

// Handle POST request to '/start'
router.post('/start', function (req, res) {
  console.log(req.body)

  // NOTE: Do something here to start the game
  if (!req.body) return res.sendStatus(400)
  //gameId = req.body['game']

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
})

router.post('/end', function (req, res) {
  // Response data
  var data = {
    taunt: 'Outta my way, snake!'
  }

  return res.json(data)
})

// Handle POST request to '/move'
// DATA OBJECT
// {
//     "game": "hairy-cheese",
//     "mode": "advanced",
//     "turn": 4,
//     "height": 20,
//     "width": 30,
//     "snakes": [
//         <Snake Object>, <Snake Object>, ...
//     ],
//     "food": [
//         [1, 2], [9, 3], ...
//     ],
//     "walls": [    // Advanced Only
//         [2, 2]
//     ],
//     "gold": [     // Advanced Only
//         [5, 5]
//     ]
// }
//
//SNAKE
// {
//     "id": "1234-567890-123456-7890",
//     "name": "Well Documented Snake",
//     "status": "alive",
//     "message": "Moved north",
//     "taunt": "Let's rock!",
//     "age": 56,
//     "health": 83,
//     "coords": [ [1, 1], [1, 2], [2, 2] ],
//     "kills": 4,
//     "food": 12,
//     "gold": 2
// }
router.post('/move', function (req, res) {
  //console.log(req.body)

  if (!req.body) return res.sendStatus(400)

  var gameId = req.body['gameId'];
  var snakes = req.body['snakes'];
  var food = req.body['food'];

  //console.log(snakes)
  //console.log(food)
  //console.log("*** using underscore *** ")
  // find our snake
  var mysnek = _.find(snakes, function(snake) { return snake.name == MY_NAME; });
  //console.log("*** my snek *** ")
  //console.log(mysnek)
  var mysnek_head = mysnek.coords[0];
  var mysnek_coords = mysnek.coords;

  // initialize the grid
  var grid = init(mysnek, req.body);
  //console.log("*** The Grid *** ")
  //console.log(grid)

  // search for shortest path to food
  //console.log("*** food check start *** ")
  var path;
  var tentatives = new Array();
  food.forEach(function(pellet) {
     var tentative = astar.search(grid, mysnek_head, pellet);
      if (!tentative) {
          console.log("**** no path to food pellet")
          return;
      }

      // save this for later
      tentatives.push(tentative);

      // check that there are no other snake heads closer
      var path_length = _.size(tentative)
      var mysnek_length = _.size(mysnek_coords) + 1
      var dead = false
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

  // if there are no paths to food pellets then chase our tail
  var despair = false;
  if (!path) {
      console.log('no path to any food');
      path = astar.search(grid, mysnek_head, mysnek_coords[mysnek_coords.length-1]);
      despair = !path || !(_.size(path) > 1);
  }

  // if there's no path to our tail then we should pick the first 
  if (despair) {
      console.log('no path to tail!');
      // if there are no paths to food pellets closest to us, pick the closest anyway
      if (_.size(tentatives) > 0) {
         console.log("*** picking a pellet closer to other snakes *** ")
         path = tentatives[0];
      } else {
          path = [ {"x":(mysnek_head[0]+1),"y":mysnek_head[1]} ];
      }
  }

  console.log('######## THE CHOSEN PATH ##########');
  console.log(path[0]);

  var nextDirection = direction(mysnek_head, [path[0].x, path[0].y]);
  console.log(nextDirection);

  // record the move for next time
  gameState[gameId] = nextDirection;
  // Response data
  var data = {
      move: nextDirection,
      taunt: 'I am Killface!'
  }

  return res.json(data);
})

function init(mysnek, data) {
  console.log(req.body)
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

function closest(items, start) {
    var closest_item = _.min(items, function(item) {
        return distance(start, item);
    });

    return closest_item
}

/*
ifFoodAhead: If there is food in line with the snake’s current direction, this function will execute its first argument, otherwise it will execute the second argument. This was the only initial function that gave the snake information beyond its immediate surroundings.
function ifFoodAhead(grid, snake) {
}


ifDangerAhead: If the game square immediately in front of the snake is occupied with either a snake body segment or the wall, this function will execute its first argument, otherwise it will execute its second argument.

ifDangerRight: If the game square immediately to the right of the snake is occupied with either a snake body segment or the wall, this function will execute its first argument, otherwise it will execute its second argument.

ifDangerLeft: If the game square immediately to the left of the snake is occupied with either a snake body segment or the wall, this function will execute its first argument, otherwise it will execute its second argument.

progn2: This is a connectivity function that will first execute its right argument, then its left. It is the only function that allows execution of more than one terminal in a single parse of the function tree

*/

module.exports = router;
