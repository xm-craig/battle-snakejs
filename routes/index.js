var _       = require('underscore');
var astar   = require('./astar');
var express = require('express');
var router  = express.Router();

var SNEK_BUFFER = 3;

// Grid Weights
var DEFAULT = 1; // Safe path
var SNAKE = 0;   // Avoid
var WALL = 0;    // Avoid
var FOOD = 3;    // Important
var GOLD = 4;    // More important
var SAFTEY = 1;  // 
var SNEK_NAME = 'FriskySnake';


var snakeId;
var gameId;

// Handle POST request to '/start'
router.post('/start', function (req, res) {
  console.log(req.body)

  // NOTE: Do something here to start the game
  if (!req.body) return res.sendStatus(400)
  gameId = req.body['game']

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

  var snakes = req.body['snakes'];
  var food = req.body['food'];

  //console.log(snakes)
  //console.log(food)
  //console.log("*** using underscore *** ")
  // find our snake
  var mysnek = _.find(snakes, function(snake) { return snake.name == SNEK_NAME; });
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
          if (enemy.name == SNEK_NAME)
              return;
          if (path_length > distance(enemy['coords'][0], pellet))
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
      path = astar.search(mysnek_head, mysnek_coords[mysnek_coords.length-1], grid, mysnek_coords);
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
  console.log(direction(mysnek_head, [path[0].x, path[0].y]));

  // Response data
  var data = {
      move: direction(mysnek_head, [path[0].x, path[0].y]),
      taunt: 'I am Killface!'
  }

  return res.json(data);
})

function init(mysnek, data) {
  var snakes = data.snakes;
  var food = data.food;

  var grid = matrix(data.height, data.width, DEFAULT);

  if (snakes.length) {
      snakes.forEach(function(snek) {
        snek['coords'].forEach(function(coord) {
          grid[coord[0]][coord[1]] = SNAKE;
        })
      })
  }
  if (food.length) {
      console.log(food)
      food.forEach(function(f) {
          grid[f[0]][f[1]] = FOOD;
      })
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

module.exports = router;

/*
    print data
    print '##################'
    snek, grid = init(data)

    #foreach snake
    for enemy in data['snakes']:
        if (enemy['id'] == ID):
            continue
        if distance(snek['coords'][0], enemy['coords'][0]) > SNEK_BUFFER:
            continue
        if (len(enemy['coords']) > len(snek['coords'])-1):
            #dodge
            if enemy['coords'][0][1] < data['height']-1:
                grid[enemy['coords'][0][0]][enemy['coords'][0][1]+1] = SAFTEY
            if enemy['coords'][0][1] > 0:
                grid[enemy['coords'][0][0]][enemy['coords'][0][1]-1] = SAFTEY

            if enemy['coords'][0][0] < data['width']-1:
                grid[enemy['coords'][0][0]+1][enemy['coords'][0][1]] = SAFTEY
            if enemy['coords'][0][0] > 0:
                grid[enemy['coords'][0][0]-1][enemy['coords'][0][1]] = SAFTEY


    snek_head = snek['coords'][0]
    snek_coords = snek['coords']
    path = None
    middle = [data['width'] / 2, data['height'] / 2]
    foods = sorted(data['food'], key = lambda p: distance(p,middle))
    for food in foods:
        #print food
        tentative_path = a_star(snek_head, food, grid, snek_coords)
        if not tentative_path:
            #print "no path to food"
            continue

        path_length = len(tentative_path)
        snek_length = len(snek_coords) + 1

        dead = False
        for enemy in data['snakes']:
            if enemy['id'] == ID:
                continue
            if path_length > distance(enemy['coords'][0], food):
                dead = True
        if dead:
            continue

        # Update snek
        if path_length < snek_length:
            remainder = snek_length - path_length
            new_snek_coords = list(reversed(tentative_path)) + snek_coords[:remainder]
        else:
            new_snek_coords = list(reversed(tentative_path))[:snek_length]

        if grid[new_snek_coords[0][0]][new_snek_coords[0][1]] == FOOD:
            # we ate food so we grow
            new_snek_coords.append(new_snek_coords[-1])

        # Create a new grid with the updates snek positions
        new_grid = copy.deepcopy(grid)

        for coord in snek_coords:
            new_grid[coord[0]][coord[1]] = 0
        for coord in new_snek_coords:
            new_grid[coord[0]][coord[1]] = SNAKE

        printg(grid, 'orig')
        printg(new_grid, 'new')

        print snek['coords'][-1]
        foodtotail = a_star(food,new_snek_coords[-1],new_grid, new_snek_coords)
        if foodtotail:
            path = tentative_path
            break
        print "no path to tail from food"



    if not path:
        path = a_star(snek_head, snek['coords'][-1], grid, snek_coords)

    despair = not (path and len(path) > 1)

    if despair:
        for neighbour in neighbours(snek_head,grid,0,snek_coords, [1,2,5]):
            path = a_star(snek_head, neighbour, grid, snek_coords)
            #print 'i\'m scared'
            break

    despair = not (path and len(path) > 1)


    if despair:
        for neighbour in neighbours(snek_head,grid,0,snek_coords, [1,2]):
            path = a_star(snek_head, neighbour, grid, snek_coords)
            #print 'lik so scared'
            break

    if path:
        assert path[0] == tuple(snek_head)
        assert len(path) > 1

    print path
    print '##################'
    return {
        'move': direction(path[0], path[1]),
        'taunt': 'TRAITOR!'
    }

def goals(data):
    result = data['food']
    return result

def direction(from_cell, to_cell):
    dx = to_cell[0] - from_cell[0]
    dy = to_cell[1] - from_cell[1]

    if dx == 1:
        return 'east'
    elif dx == -1:
        return 'west'
    elif dy == -1:
        return 'north'
    elif dy == 1:
        return 'south'

def distance(p, q):
    dx = abs(p[0] - q[0])
    dy = abs(p[1] - q[1])
    return dx + dy;

def closest(items, start):
    closest_item = None
    closest_distance = 10000

    # TODO: use builtin min for speed up
    for item in items:
        item_distance = distance(start, item)
        if item_distance < closest_distance:
            closest_item = item
            closest_distance = item_distance

    return closest_item

def init(data):
    mysnake = next(x for x in data['snakes'] if x['name'] == snake_name)

    grid = [[0 for col in xrange(data['height'])] for row in xrange(data['width'])]
    for snek in data['snakes']:
        for coord in snek['coords']:
            grid[coord[0]][coord[1]] = SNAKE

#    if data['mode'] == 'advanced':
#        for wall in data['walls']:
#            grid[wall[0]][wall[1]] = WALL
#        for g in data['gold']:
#            grid[g[0]][g[1]] = GOLD

    for f in data['food']:
        grid[f[0]][f[1]] = FOOD

    return mysnake, grid

*/
