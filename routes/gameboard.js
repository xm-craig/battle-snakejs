var astar  = require('./astar');
var _      = require('underscore');

// Constants
// Snake Identifier
var MY_NAME = 'FriskySnake';

// Grid Weights
var GOLD   = 5;  // Most Important
var FOOD   = 3;  // Important
var SAFTEY = 1;  // Safe path
var SNAKE  = 0;  // Avoid
var WALL   = 0;  // Avoid


/**
 * Decide which state we want to be in for current move
 * Previous state codes:
 *       0 = Feeding   - getting food
 *       1 = Defensive - protecting food
 *       2 = Offensive - Eating snakes
 */
var gameState = {};

var gameboard = {

  initGame: function(data) {
    var snakes = data.snakes;
    var foods = data.food;

    // if the server was restarted in the middle of game play, we recreate the gameState
    if (!gameState[data.game_id])
      gameState[data.game_id] = {
          "middle": [Math.trunc(data.width/2), Math.trunc(data.height/2)],
          "taunt_count": 1,
          "state": 0,
          "move": "none"
    };

    var grid = this.matrix(data.height, data.width, SAFTEY);

    if (_.size(snakes) > 0) {
        snakes.forEach(function(snek) {
          snek['coords'].forEach(function(coord) {
            grid[coord[0]][coord[1]] = SNAKE;
          })
        })
    }
      if (_.size(foods) > 0) {
        foods.forEach(function(f) {
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
  },

  makeMove: function(data) {
      var gameboard = this;
      var gameId = data['game_id'];
      var snakes = data['snakes'];
      var food = data['food'];

      // find our snake
      var mysnek = _.find(snakes, function(snake) { return snake.name == MY_NAME; });
      var mysnek_head = mysnek.coords[0];
      var mysnek_coords = mysnek.coords;
      var mysnek_length = this.getSnakeLen(mysnek);
      var otherSnakes = _.reject(snakes, function(snake) {return snake.name==mysnek.name;});

      // initialize the grid
      var grid = this.initGame(data);

      // search for shortest path to food
      var path = [];
      var tentatives = new Array();
      food.forEach(function(pellet) {
          var tentative = astar.search(grid, mysnek_head, pellet);
          if (!tentative) {
              console.log("**** no path to food pellet");
              return;
          }

          // save this for later
          tentatives.push(tentative);
          // avoid collisions with larger snakes that are closer
          // var dead = gameboard.collisonCheck(mysnek, otherSnakes, pellet);
          var dead = false;
          var path_length = gameboard.getDistance(mysnek_head, pellet);
          console.log("**** ME **** : " +path_length );
          otherSnakes.forEach(function(enemy) {
              console.log("**** ENEMY **** : " + gameboard.getDistance(enemy['coords'][0], pellet) );
              if (path_length > gameboard.getDistance(enemy['coords'][0], pellet))
                  dead = true;
          });

          console.log("**** DEAD **** : " + dead);
          if (dead)
              return;

          if (_.size(path) == 0 || (_.size(path) > _.size(tentative)))
            path = tentative;
      })

      // if there are no paths to food pellets then head to the middle or chase our tail
      var despair = false;
      if (!path || !(_.size(path) > 0)) {
          middle = this.findSafestNeighbours(gameState[gameId].middle, grid);
          console.log('*** no path to any food so lets head for the middle: ' + middle);
          if (_.size(middle))
              path = astar.search(grid, mysnek_head, middle[0]);
      }
      if (!path || !(_.size(path) > 0)) {
          console.log('*** no path to any food or the middle so lets chase our tail');
          tail = this.findSafestNeighbours(mysnek_coords[mysnek_coords.length-1], grid);
          if (_.size(tail))
              path = astar.search(grid, mysnek_head, tail[0]);
      }

      if (!path || !(_.size(path) > 0)) {
          console.log('*** no path to any food, the middle, or our tail, so lets head towards a corner');
          var corners = this.findCorners(mysnek_head, grid);
console.log("*** *** corners: " + corners);
          // a sorted list of possible paths to each accessible corner
          path = this.closestPathsToFood(grid, mysnek, corners, otherSnakes);
console.log("*** *** safest path to corner: " + path);
          despair = !path || !(_.size(path) > 0);
      }

      // if there's no path to our tail or the middle of the board then we should pick the first safest location
      if (despair) {
          console.log('*** DESPAIR: no path to food or our tail or the middle');
          // if there are no paths to food pellets closest to us, pick the second closest anyway
          if (_.size(tentatives) > 1) {
              console.log("*** picking the second closest pellet to us *** ");
              path = tentatives[1];
          //} else if (_.size(tentatives) > 0) {
          //    console.log("*** picking the closest pellet to us *** ");
          //    path = tentatives[0];
          } else {
              // if there are no potential food pellets then pick the first safest location
              console.log("*** picking the safest location *** ");
              path = [ this.findSafestNeighbour(mysnek_head, grid) ];
          }
      }

      var nextDirection = this.getDirection(mysnek_head, [path[0].x, path[0].y]);
      // record the move for next time
      gameState[gameId].move = nextDirection;
      return nextDirection;
  },

  newMove: function(data) {
      //console.log("*** GAME STATE ***");
      //console.log(gameState[gameId]);

      var gameId = data['game_id'];
      var snakes = data['snakes'];
      var foods = data['food'];
      var snakeCount = _.size(snakes);
      var foodCount = _.size(foods);

      // initialize the grid
      var grid = this.initGame(data);

      // find our snake
      var mysnek = _.find(snakes, function(snake) { return snake.name == MY_NAME; });
      var mysnek_head = mysnek.coords[0];
      var mysnek_len = this.getSnakeLen(mysnek);
      var mysnek_health = mysnek["health_points"];

      // Sort out the other snakes by size and distance
      var otherSnakes = _.reject(snakes, function(snake) {return snake.name==mysnek.name;});
      var snakesBySize = this.getSnakesBySize(otherSnakes);
      var snakesByDistance = this.getSnakesByDistance(otherSnakes, mysnek);

      // a sorted list of possible paths to each accessible food pellet
      var safestPath = this.closestPathsToFood(grid, mysnek, foods, otherSnakes);
//console.log("*** *** safest path: " + safestPath);
      var closestFood = this.findClosest(foods, mysnek_head);
      var closestSnake = snakesByDistance[0];
//console.log("*** *** closest snake: " + JSON.stringify(closestSnake));
      var smallestSnake = snakesBySize[0];
//console.log("*** *** smallest snake: " + JSON.stringify(smallestSnake));

      //  Determine the threshold of when to move to food
      var threshold = 40; // number of moves to obtain the next food pellet

      var defensiveThreshold = this.getDistance(mysnek_head, closestFood) + 5;

      // determine best move
      var state = gameState[gameId].state;

      //  DEFENSIVE MOVE
      //  If previous state was FEEDING
      //  and number of food pellets is less than number of snakes
      //  and there's at least one safe path to food
      //  and my health is great than the smallest snake on the board
      //  and number of moves to defend is less than my health
      //  and number of moves to defend is less than the closest enemy snake to the food
      var numberOfDefensiveMoves = this.numberOfMovesToDefend(otherSnakes, mysnek, closestFood);

      var startDefensive =
          (state == 0) &&
          (snakeCount > foodCount) &&
          (_.size(safestPath) > 0) &&
          (mysnek_health > smallestSnake.health_points) &&
          (numberOfDefensiveMoves < mysnek_health) &&
	  this.areSqCornersOnBoard(mysnek, closestFood, data.width, data.height) &&
          (numberOfDefensiveMoves < this.getDistance(closestSnake.coords[0], closestFood));
//console.log("*** get defensive: " + startDefensive);

      //  OFFENSIVE MOVE
      //  If previous state was FEEDING
      //  and closest snake is closer than closest food
      //  and closest snake position is two positions away
      //  and our snake is longer by two or more than the closest snake
      //  and health is above threshold
      var startOffensive = 
          (state == 0) &&
	  (this.getDistance(closestSnake.coords[0], mysnek_head) < this.getDistance(mysnek_head, closestFood)) &&
          ((mysnek_len - this.getSnakeLen(closestSnake)) >= 2) &&
          (this.getDistance(closestSnake.coords[0], mysnek_head) <= 2);
//console.log("*** get offensive: " + startOffensive);

      if (state == 1 && mysnek_health > defensiveThreshold) {
          console.log("*** Still on the defensive");
          //  If previous state was DEFENSIVE and health above threshold --> continue DEFENSIVE
          gameState[gameId].state = 1;
          var corners = this.getSqCorners(mysnek, closestFood);
console.log("*** DEF *** corners: " + corners);
          var nextDirection = this.getDefensiveMove(grid, mysnek, corners, closestSnake);
          // record the move for next time
console.log("*** DEF *** next move: " + nextDirection);
          gameState[gameId].move = nextDirection;
          return nextDirection;
      } else if ((state == 2) && 
		 (mysnek_health > threshold) && 
		 (this.getDistance(closestSnake.coords[0], mysnek_head) < this.getDistance(mysnek_head, closestFood))) {
console.log("*** OFF *** Still on the offensive");
          //  If previous state was OFFENSIVE and health above threshold --> continue OFFENSIVE
          gameState[gameId].state = 2;
          var nextDirection = this.getOffensiveMove(grid, mysnek, closestSnake);
          gameState[gameId].move = nextDirection;
console.log("*** OFF *** next move: " + nextDirection);
          return nextDirection;
      } else if (startDefensive) {
          //  If previous state was FEEDING start a DEFENSIVE play under the above conditions
      console.log("*** DEF *** " + numberOfDefensiveMoves);
      console.log("*** DEF *** " + (state == 0));
      console.log("*** DEF *** " + (snakeCount > foodCount));
      console.log("*** DEF *** " + (_.size(safestPath) > 0));
      console.log("*** DEF *** " + (mysnek_health > smallestSnake.health_points));
      console.log("*** DEF *** " + this.areSqCornersOnBoard(mysnek, closestFood, data.width, data.height));
      console.log("*** DEF *** " + (numberOfDefensiveMoves < mysnek_health));
      console.log("*** DEF *** " + (numberOfDefensiveMoves < this.getDistance(closestSnake.coords[0], closestFood)));
          gameState[gameId].state = 1;
          var corners = this.getSqCorners(mysnek, closestFood);
      console.log("*** DEF *** corners: " + corners);
          var nextDirection = this.getDefensiveMove(grid, mysnek, corners, closestSnake);
          // record the move for next time
          gameState[gameId].move = nextDirection;
console.log("*** DEF *** next move: " + nextDirection);
          return nextDirection;
      } else if (startOffensive) {
          //  If previous state was FEEDING start an OFFENSIVE play under the above conditions
console.log("*** OFF *** " + (state == 0));
console.log("*** OFF *** " + (this.getDistance(closestSnake.coords[0], mysnek_head) < this.getDistance(mysnek_head, closestFood)));
console.log("*** OFF *** " + ((mysnek_len - this.getSnakeLen(closestSnake)) >= 2));
console.log("*** OFF *** " + (this.getDistance(closestSnake.coords[0], mysnek_head) <= 2));

          gameState[gameId].state = 2;
          var nextDirection = this.getOffensiveMove(grid, mysnek, closestSnake);
          gameState[gameId].move = nextDirection;
console.log("*** OFF *** next move: " + nextDirection);
          return nextDirection;
      }

      if (_.size(safestPath) > 0) {
          //  ALWAYS FEEDING
          //  UNLESS on defensive or the offensive
          //  If previous state was DEFENSIVE and health < threshold
          //  If previous state was OFFENSIVE and health < threshold
console.log("*** Still FEEDING");
          gameState[gameId].state = 0;
//console.log("*** my head: " + mysnek_head);

          var nextDirection = this.getDirection(mysnek_head, [safestPath[0].x, safestPath[0].y]);
          // record the move for next time
          gameState[gameId].move = nextDirection;
console.log("*** next move: " + nextDirection);
          return nextDirection;
      }

      // if there are no paths to food pellets then head to the middle or chase our tail
      var despair = false;
      if (!safestPath || !(_.size(safestPath) > 0)) {
          console.log('*** no path to any food so lets head for the middle');
          safestPath = astar.search(grid, mysnek_head, gameState[gameId].middle);
      }
      if (!safestPath || !(_.size(safestPath) > 0)) {
          console.log('*** no path to any food or the middle so lets chase our tail');
          safestPath = astar.search(grid, mysnek_head, mysnek.coords[mysnek.coords.length-1]);
          despair = !safestPath || !(_.size(safestPath) > 0);
      }

      // if there's no path to our tail or the middle of the board then we should pick the first safest location
      if (despair) {
          console.log('*** DESPAIR: no path to food or our tail or the middle');
          // if there are no potential food pellets then pick the first safest location
          console.log("*** picking the safest location *** ");
          safestPath = [ this.findSafestNeighbour(mysnek_head, grid) ];
      }

      gameState[gameId].state = 0;
      var nextDirection = this.getDirection(mysnek_head, [safestPath[0].x, safestPath[0].y]);
      // record the move for next time
      gameState[gameId].move = nextDirection;
      console.log("*** next move 2: " + nextDirection);
      return nextDirection;
  },

  numberOfMovesToDefend: function(snakes, mysnake, pellet) {
      var head = mysnake.coords[0];
      // we only count two sides as long as our snake defends in the direction of the other snake
      var squareLength = (this.getSqSideLen(this.getSnakeLen(mysnake))-1)*2;

      var snakesByDistance = this.getSnakesByDistance(snakes, pellet);
      var closestSnake = snakesByDistance[0];

      var corners = this.getSqCorners(mysnake, pellet);
      var closestCorner = this.findClosest(corners, head);
      // account for the closest corner as minus one
      return this.getDistance(closestCorner, head) + squareLength - 1;
  },

  /**
   * Search for shortest path to all food pellets.
   * Returns a sorted list of paths to each food pellet.
   */
  closestPathsToFood: function(grid, mysnek, foods, snakes) {
      var gameboard = this;
      var head = mysnek.coords[0];
      var paths = new Array();
      var pellets = _.sortBy(foods, function(pellet) {return gameboard.getDistance(head, pellet)});
      pellets.forEach(function(pellet) {
          // avoid food where other snakes are closer, or are larger than us
          if (gameboard.collisonCheck(mysnek, snakes, pellet)) return;
          // find shortest path
          var path = astar.search(grid, head, pellet);
          if (!path) return;
          // save as a potential goal
          paths.push(path);
      });

      return paths[0];//_.sortBy(paths, function(path) {return _.size(path)});
  },

  /**
   *  Get the move required to keep our snake in a defensive square formation around a food item
   */
    getDefensiveMove: function(grid, snake, sqCorners, closestSnake) {
      var snakeHead = snake['coords'][0];
      var direction = this.getSnakesDirection(snake);

      var traversedCorners = _.intersection(sqCorners, snake['coords']);
      console.log("traversed: " + traversedCorners);
      if (_.size(traversedCorners) == 0) {
          var target = this.findClosest(sqCorners, snakeHead);
          var path = astar.search(grid, snakeHead, target);
          console.log("heading for a corner: " + path);
          return this.getDirection(snakeHead, [path[0].x, path[0].y]);
      }
      // 
      var headIndex = _.indexOf(sqCorners, snakeHead);
      if (headIndex > -1) {
          // lets find out which direction the snake is turning
          // let's see if we have traversed more than one corner
          if (_.size(traversedCorners) > 1) {
              // let's sort the traversed corners by their index in our snake coords
              var sortedCorners = _.sortBy(traversedCorners, function(corner) {return _.indexOf(snake.coords, corner)});
              var diff = headIndex - _.indexOf(sqCorners, sortedCorners[1]);
              if (diff == -1 || diff == 3)
              return turnLeft(direction);
            return turnRight(direction);
          }

          // we're just hitting our first corner, have not traversed other corners yet
          var left = sqCorners[(index + 3) % 4];
          var right = sqCorners[(index + 1) % 4];
          var enemy = closestSnake.coords[0];
          if (this.getDistance(enemy, left) < this.getDistance(enemy, right))
            return this.getDirection(snakeHead, left);
          return this.getDirection(snakeHead, right);
      }
      // we're in defensive mode, lets just keep going in the same direction
      return direction;
  },

  /**
   *  Get the move required to kill the other snake. This only ever happens when it's close enough.
   */
  getOffensiveMove: function(grid, mysnake, closestSnake) {
      var head = mysnake['coords'][0];
console.log("*** OFF - head: " + head)

      var target = closestSnake['coords'][0];
      var possibleMoves = this.findSafestNeighbours(target, grid);      
      var closesttarget = this.findClosest(possibleMoves, head)
console.log("*** OFF - target: " + closesttarget)

      var path = astar.search(grid, head, closesttarget);
console.log("*** OFF - path: " + path)
      return this.getDirection(head, [path[0].x, path[0].y]);
  },

  findCorners: function(head, grid) {
    var gameboard = this;

    var ret = [];
    ret.push([0, 0]);
    ret.push([_.size(grid)-1, 0]);
    ret.push([_.size(grid)-1, _.size(grid[0])-1]);
    ret.push([0, _.size(grid[0])-1]);

    return _.sortBy(ret, function(corner) {
      return gameboard.getDistance(corner, head);
    });
  },

/**
 * Distance between two coordinates in a matrix:
 * ex.  [1,1] and [2,2]
 */
  getDistance: function(p, q) {
    var dx = Math.abs(p[0] - q[0]);
    var dy = Math.abs(p[1] - q[1]);
    return dx + dy;
  },

  getDirection: function(from_cell, to_cell) {
    var dx = to_cell[0] - from_cell[0];
    var dy = to_cell[1] - from_cell[1];

    if (dx == 1)
        return 'right'
    else if (dx == -1)
        return 'left'
    else if (dy == -1)
        return 'up'

    return 'down'
  },

  matrix: function(rows, cols, defaultValue) {
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
  },

  findSafestNeighbours: function(head, grid) {
    var ret = [];
    var x = head[0];
    var y = head[1];
    var board = grid;

    // Check West
    if (board[x - 1] && board[x - 1][y]) {
        ret.push([(x-1), y ]);
    }

    // Check East
    if (board[x + 1] && board[x + 1][y]) {
        ret.push([(x+1), y ]);
    }

    // Check South
    if (board[x] && board[x][y - 1]) {
        ret.push([x, (y-1)]);
    }

    // Check North
    if (board[x] && board[x][y + 1]) {
        ret.push([x, (y+1)]);
    }

    return ret;
  },

  findSafestNeighbour: function(head, grid) {
    var ret = [];
    var x = head[0];
    var y = head[1];
    var board = grid;

    // Check West
    if (board[x - 1] && board[x - 1][y]) {
        return {"x":(x-1), "y":y };
    }

    // Check East
    if (board[x + 1] && board[x + 1][y]) {
        return {"x":(x+1), "y":y };
    }

    // Check South
    if (board[x] && board[x][y - 1]) {
        return {"x":x, "y":(y-1) };
    }

    // Check North
    if (board[x] && board[x][y + 1]) {
        return {"x":x, "y":(y+1) };
    }

    // this will cause a down action
    return head;
  },

  getSnakesByDistance: function(snakes, target) {
    var gameboard = this;
    return _.sortBy(snakes, function(snake) {
      return gameboard.getDistance(target, snake.coords[0]);
    });
  },

  getSnakesBySize: function(snakes) {
    var gameboard = this;
    return _.sortBy(snakes, function(snake) {
       return gameboard.getSnakeLen(snake);
    });
  },

  findClosest: function(items, start) {
    var gameboard = this;
    var closest_item = _.min(items, function(item) {
        return gameboard.getDistance(start, item);
    });

    return closest_item
  },

  nextTaunt: function(gameId) {
      var tc = gameState[gameId].taunt_count++;
      if (tc > 50) gameState[gameId].taunt_count=1;

      if (tc <= 5)
        return 'I'
      else if (tc <= 10)
        return 'AM'
      else if (tc <= 15)
        return 'Killface!'
      else if (tc <= 20)
        return 'Bow'
      else if (tc <= 25)
        return 'Down'
      else if (tc <= 50)
        return 'Behold The Annihilatrix!'
      return 'I am Killface!'
  },

  /**
   * Get the side length of the minimum incomplete square that can
   * be formed by a snake of length n
   * 
   */
  getSqSideLen: function(n) {
      for (var i=1;i<9999;i++) {
          var sidelen = i * 2 + 1;
          // the n length must be one less the total square size
          var sqlen = (sidelen-1)*4 - 1;
          if (sqlen > n)
            return sidelen;
      }
      return 25;
  },

  /**
   * Get an array of length 4 of the coordinates that define the defensive square:
   *  [top-left, top-right, bottom-right, bottom-left]
   * assumes snake is 1 away from food
   */
  getSqCorners: function(snake, closeFood) {
      var squareDim = (this.getSqSideLen(this.getSnakeLen(snake))-1)/2;

      var snakeHead = snake['coords'][0];
      var sX = snakeHead[0];
      var sY = snakeHead[1];

      var cX = closeFood[0];
      var cY = closeFood[1];

      return [[cX-squareDim,cY-squareDim], [cX+squareDim,cY-squareDim], [cX+squareDim, cY+squareDim], [cX-squareDim, cY+squareDim]];

//      var dx = cX - sX;
//      var dy = cY - sY;
//
//      // food is right of head, closest corner is bottom left
//      if (dx == 1)
//          return [[sX,sY-squareDim+2], [sX+squareDim-1,sY-squareDim+2], [sX+squareDim-1, sY+1], [sX, sY+1]];
//
//      // food is left of head, closest corner is top right
//      if (dx == -1)
//          return [[sX-squareDim+1, sY-1], [sX, sY-1], [sX, sY+squareDim-2], [sX-squareDim+1, sY+squareDim-2]];
//
//      // food is below head, closest corner is top left
//      if (dy == 1)
//          return [[sX-1, sY], [sX+squareDim-2, sY], [sX+squareDim-2, sY+squareDim-1], [sX-1, sY+squareDim-1]];
//
//      // food is above head, closest corner is bottom right
//      return [[sX-squareDim+2, sY-squareDim+1], [sX+1, sY-squareDim+1], [sX+1, sY], [sX-squareDim+2, sY]];

  },

  areSqCornersOnBoard: function(snake, food, width, height) {
      var dead = false;
      var corners = this.getSqCorners(snake, food);
      corners.forEach(function(corner) {
          dead =
	      (corner[0] < 0) || 
	      (corner[1] < 0) || 
	      (corner[0] > width) ||
	      (corner[1] > height);
	  if (dead) return;
      });
      console.log("*** Square On Board: " + dead);
      return dead;

      // TODO - REDO This logic
      //if (_.min(corners, function(corner) {return corner[0] < corner[1] ? corner[0] : corner[1]}) < 0)
      //	  return false;
      //if (_.max(corners, function(corner) {return corner[0]}) > width)
      //	  return false;
      //if (_.max(corners, function(corner) {return corner[1]}) > height)
      //	  return false;
      //return true;
  },

  // is N left of P
  isLeftOf: function(n, p) {
      var dx = n[0] - p[0];
      return dx < 0;
  },
  // is N right of P
  isRightOf: function(n, p) {
      var dx = n[0] - p[0];
      return dx > 0;
  },
  // is N Below P
  isBelow: function(n, p) {
      var dy = n[1] - p[1];
      return dy > 0;
  },
  // is N above P
  isAbove: function(n, p) {
      var dy = n[1] - p[1];
      return dy < 0;
  },

  turnRight: function(direction) {
      if (direction == 'right')
        return 'down'
      if (direction == 'left')
        return 'up'
      if (direction == 'up')
        return 'right'
      return 'left';
  },

  turnLeft: function(direction) {
      if (direction == 'right')
        return 'up'
      if (direction == 'left')
        return 'down'
      if (direction == 'up')
        return 'left'
      return 'right';
  },

  // Get the length of a snake
  getSnakeLen: function(snake) {
      return _.size(snake['coords']);
  },


  // Get the direction a snake is facing
  getSnakesDirection: function(snake) {
      fst = snake['coords'][0]
      snd = snake['coords'][1]

      dx = fst[0] - snd[0]
      dy = fst[1] - snd[1]

      if (dx == 1)
          return 'right';
      if (dx == -1)
           return 'left';
      if (dy == 1)
          return 'down';
      return 'up';
  },

  isDangerTwoAhead: function(snake_head, direction, grid) {
      var dx = snake_head[0];
      var dy = snake_head[1];

      if (direction == 'right')
          dx = dx+2;
      if (direction == 'left')
          dx=dx-2;
      if (direction == 'up')
          dy=dy+2;
      if (direction == 'down')
          dy=dy-2;

      return (grid[dx,dy] == 0);
  },

  /**
   * Check that there are no other snakes closer, that are larger than me
   */
  collisonCheck: function(mysnek, snakes, food) {
      var gameboard = this;
      var mysnek_head = mysnek.coords[0];
      var path_length = this.getDistance(mysnek_head, food);
      var mysnek_length = this.getSnakeLen(mysnek);

      var dead = false;
      snakes.forEach(function(enemy) {
          if (enemy.name == mysnek.name)
              return;
          if ((path_length >= gameboard.getDistance(enemy['coords'][0], food)) &&
              (mysnek_length < gameboard.getSnakeLen(enemy)))
              dead = true;
      })
      return dead;
  }

};

module.exports = gameboard;

/*

# Return a collision free move
def desperation(snake, data, move):
      opts = ['up', 'down', 'right', 'left']
      opts.remove(move)
      bad = []
      for item in opts:
            if checkCollision(snake, data, item) == True:
                  bad.append(item)
      remove_common_elements(opts, bad)
      if len(opts) > 0:
            return random.choice(opts)
      return 'left'

*/
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
