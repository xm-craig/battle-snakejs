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
          "middle": [(data.width/2), (data.height/2)],
          "taunt_count": 1,
          "state": 0,
          "sqCorners": []
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
        //console.log(foods)
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
      var grid = this.initGame(req.body);

      // search for shortest path to food
      var path = [];
      var tentatives = new Array();
      food.forEach(function(pellet) {
         var tentative = astar.search(grid, mysnek_head, pellet);
          if (!tentative) {
              //console.log("**** no path to food pellet");
              return;
          }

          // save this for later
          tentatives.push(tentative);
          // avoid collisions with larger snakes that are closer
          var dead = this.collisonCheck(mysnek, otherSnakes, pellet);
          if (dead)
              return;

          if (_.size(path) == 0 || (_.size(path) > _.size(tentative)))
            path = tentative;
      })

      // if there are no paths to food pellets then head to the middle or chase our tail
      var despair = false;
      if (!path) {
          console.log('*** no path to any food so lets head for the middle');
          path = astar.search(grid, mysnek_head, gameState[gameId].middle);
      }
      if (!path || !(_.size(path) > 0)) {
          console.log('*** no path to any food or the middle so lets chase our tail');
          path = astar.search(grid, mysnek_head, mysnek_coords[mysnek_coords.length-1]);
          despair = !path || !(_.size(path) > 0);
      }

      // if there's no path to our tail or the middle of the board then we should pick the first safest location
      if (despair) {
          console.log('*** DESPAIR: no path to food or our tail or the middle');
          // if there are no paths to food pellets closest to us, pick the second closest anyway
          if (_.size(tentatives) > 1) {
              console.log("*** picking the second closest pellet to us *** ");
              path = tentatives[1];
          } else if (_.size(tentatives) > 0) {
              console.log("*** picking the closest pellet to us *** ");
              path = tentatives[0];
          } else {
              // if there are no potential food pellets then pick the first safest location
              console.log("*** picking the safest location *** ");
              path = [ this.findSafestNeighbour(mysnek_head, grid) ];
          }
      }

      var nextDirection = this.getDirection(mysnek_head, [path[0].x, path[0].y]);
      // record the move for next time
      gameState[gameId] = _.extend(gameState[gameId] || {}, {"move": nextDirection});
      return nextDirection;
  },

  newMove: function(data) {
      //console.log("*** GAME STATE ***");
      //console.log(gameState[gameId]);

      var gameId = data['game_id'];
      var snakes = data['snakes'];
      var food = data['food'];
      var snakeCount = _.size(snakes);
      var foodCount = _.size(food);

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
      var safestPath = this.closestPathsToFood(grid, mysnek, food, otherSnakes);
      var closestFood = this.findClosest(food, mysnek_head);
      var closestSnake = snakesByDistance[0];
      var smallestSnake = snakesBySize[0];

      //  Determine the threshold of when to move to food
      var threshold = 40; // number of moves to obtain the next food pellet

      var defensiveThreshold = this.getDistance(mysnek_head, closestFood) + 5;

      // determine best move
      var move = 'down';
      var state = gameState[gameId].state;

      //  DEFENSIVE MOVE
      //  If previous state was FEEDING
      //  and number of food pellets is less than number of snakes
      //  and there's at least one safe path to food
      //  and my health is great than the smallest snake on the board
      //  and number of moves to defend is less than my health
      //  and number of moves to defend is less than the closest enemy snake to the food
      var numberOfDefensiveMoves = this.numberOfMovesToDefend(otherSnakes, mysnek, closestFood);
      console.log("*** moves to defend: " + numberOfDefensiveMoves);
      var startDefensive =
          (state == 0) &&
          (snakeCount > foodCount) &&
          (_.size(safestPath) > 0) &&
          (mysnek_health > smallestSnake.health) &&
          (numberOfDefensiveMoves < mysnek_health) &&
          (numberOfDefensiveMoves < this.getDistance(closestSnake.coords[0], closestFood));
      console.log("*** get defensive: " + startDefensive);

      //  OFFENSIVE MOVE
      //  If previous state was FEEDING
      //  and closest snake position is two positions away
      //  and our snake is longer by two or more than the closest snake
      //  and health is above threshold
      var startOffensive = 
          (state == 0) &&
          ((mysnek_len - this.getSnakeLen(closestSnake)) >= 2) &&
          (this.getDistance(closestSnake.coords[0], mysnek_head) <= 2);

      if (state == 1 && mysnek_health > defensiveThreshold) {
          console.log("*** Still on the defensive");
          //  If previous state was DEFENSIVE and health above threshold --> continue DEFENSIVE
          gameState[gameId].state = 1;
          var corners = this.getSqCorners(mysnek, closestFood);
          var nextDirection = this.getDefensiveMove(mysnek, corners, closestSnake);
          // record the move for next time
          gameState[gameId] = _.extend(gameState[gameId] || {}, {"move": nextDirection});
          return nextDirection;
      } else if (state == 2 && mysnek_health > threshold) {
          console.log("*** Still on the offensive");
          //  If previous state was OFFENSIVE and health above threshold --> continue OFFENSIVE
          gameState[gameId].state = 2;
//      } else if (startDefensive) {
//          //  If previous state was FEEDING start a DEFENSIVE play under the above conditions
//          gameState[gameId].state = 1;
//          var corners = this.getSqCorners(mysnek, closestFood);
//          var nextDirection = this.getDefensiveMove(mysnek, corners, closestSnake);
//          // record the move for next time
//          gameState[gameId] = _.extend(gameState[gameId] || {}, {"move": nextDirection});
//          return nextDirection;
//      } else if (startOffensive) {
//          //  If previous state was FEEDING start an OFFENSIVE play under the above conditions
//          gameState[gameId].state = 2;
//          console.log("*** get offensive: " + startOffensive);
      }
      else if (_.size(safestPath) > 0) {
        //  ALWAYS FEEDING
        //  UNLESS on defensive or the offensive
        //  If previous state was DEFENSIVE and health < threshold
        //  If previous state was OFFENSIVE and health < threshold
        console.log("*** Still FEEDING");
        gameState[gameId].state = 0;
        var nextDirection = this.getDirection(mysnek_head, [closestFood[0].x, closestFood[0].y]);
        // record the move for next time
        gameState[gameId] = _.extend(gameState[gameId] || {}, {"move": nextDirection});
        return nextDirection;
      }

      // if there are no paths to food pellets then head to the middle or chase our tail
      var despair = false;
      if (!safestPath) {
          console.log('*** no path to any food so lets head for the middle');
          safestPath = astar.search(grid, mysnek_head, gameState[gameId].middle);
      }
      if (!safestPath || !(_.size(safestPath) > 0)) {
          console.log('*** no path to any food or the middle so lets chase our tail');
          safestPath = astar.search(grid, mysnek_head, mysnek_coords[mysnek_coords.length-1]);
          despair = !safestPath || !(_.size(safestPath) > 0);
      }

      // if there's no path to our tail or the middle of the board then we should pick the first safest location
      if (despair) {
          console.log('*** DESPAIR: no path to food or our tail or the middle');
          // if there are no potential food pellets then pick the first safest location
          console.log("*** picking the safest location *** ");
          safestPath = [ this.findSafestNeighbour(mysnek_head, grid) ];
      }

      var nextDirection = this.getDirection(mysnek_head, [safestPath[0].x, safestPath[0].y]);
      // record the move for next time
      gameState[gameId] = _.extend(gameState[gameId] || {}, {"move": nextDirection});
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
      var path = [];
      var tentatives = new Array();
      foods.forEach(function(pellet) {
         var tentative = astar.search(grid, head, pellet);

          if (!tentative) return;
          // avoid food where other snakes are closer, or are larger than us
          if (gameboard.collisonCheck(mysnek, snakes, pellet)) return;

          if (_.size(path) == 0 || (_.size(path) > _.size(tentative))) {
            path = tentative;
            tentatives.push(tentative);
          }

      });

      return tentatives.reverse();
  },

  /**
   *  Get the move required to keep the snake in a defensive square formation around a food item
   */
  getDefensiveMove: function(snake, sqCorners, closestSnake) {
      var snakeHead = snake['coords'][0];
      var direction = this.getDirection(snake);
      var headIndex = _.indexOf(sqCorners, snakeHead);
      if (headIndex > -1) {
          // lets find out which direction the snake is turning
          // let's see if we have traversed more than one corner
          var filteredCorners = _.filter(sqCorners, function(corner) {return _.indexOf(snake.coords, corner) > -1});
          if (_.size(filteredCorners) > 1) {
              // let's sort the traversed corners by their index in our snake coords
              var sortedCorners = _.sort(filteredCorners, function(corner) {return _.indexOf(snake.coords, corner)});
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
      // lets jsut keep going in the same direction
      return direction;
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
      return gameboard.getDistance(target, snake);
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
    if (taunt_count > 50) this.taunt_count=1;

    if (taunt_count++ <= 5)
      return 'I'
    else if (taunt_count++ <= 10)
      return 'AM'
    else if (taunt_count++ <= 15)
      return 'Killface!'
    else if (taunt_count++ <= 20)
      return 'Bow'
    else if (taunt_count++ <= 25)
      return 'Down'
    else if (taunt_count++ <= 50)
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
      var squareDim = (this.getSqSideLen(getSnakeLen(snake))-1)/2;

      var snakeHead = snake['coords'][0];
      var sX = snakeHead[0];
      var sY = snakeHead[1];

      var cX = closeFood[0];
      var cY = closeFood[1];

      var dx = cX - sX;
      var dy = cY - sY;

      return [[cX-squareDim,cY-squareDim], [cX+squareDim,cY-squareDim], [cX+squareDim, cY+squareDim], [cX-squareDim, cY+squareDim]];

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
          if (path_length >= gameboard.getDistance(enemy['coords'][0], food) &&
              mysnek_length < gameboard.getSnakeLen(enemy))
              dead = true;
      })
      return dead;
  }

};

module.exports = gameboard;

/*
  newState: function(foodCount, snake, data) {
    global state
    global sqCorners
    foods = data['food']
    // Get our snake's head position
    snakeHead = snake['coords'][0]
        //  Determine which food is the closest to use
    closeFood = closestFood(foods, snakeHead)
        //  Determine the distance to the closest food
    dist = distance(snakeHead, closeFood)
        //  Get our snakes health
    health = snake["health_points"]
        //  Get our snakes length
    snakeLen = getSnakeLen(snake)
        //  Determine what distance away from the food we will circle at
        // cirDist = getSqSideLen(snakeLen)/2
        //  Determine the threshold of when to move to food
    threshold = dist + 5

        //  If previous state was circling food and health < threshold --> eat food
        //  If previous state was circling food and health above threshold --> continue circling
        //  If previous state was finding food and health above threshold and position is 'one' away from food --> start circling
        //  If previous state was finding food and position is more than 'one' away from food --> continue finding food
    print "state: ", state
    print "dist: ", dist
    if state == 0 and dist == 1 and health > threshold:
              // call to function defining square formation and deciding next move to enter circling state
            sqCorners, move = getSqCorners(snake, closeFood)
            print "sqCorners in 1st branch: ", sqCorners
            state = 1
    elif state == 1 and health > threshold:
              // call to function deciding next move in circling state
            move = getDefMove(snake, sqCorners)
            print "sqCorners in 2nd branch: ", sqCorners
            state = 1
    else: #state == 0:
              // call to function deciding next move in finding food state
              // move = getDirection(snake) #TODO: replace w/ logic
            move = getSeekMove(snake, data)
            state = 0
              // move = getOffMove(snakeHead, closeFood)
  }


def checkCollision(snake, data, move, **kwargs):
      # move = 'up' | 'left' | 'down' | 'right'
      # move translated to coordinates = [0, -1] | [-1, 0] | [0, 1] | [1, 0]
      # return true or false

      currentPos = snake['coords'][0]
      #if 'currentPos' in kwargs:
            #currentPos = kwargs['currentPos']

      if move == 'up':
            choice = [currentPos[0], currentPos[1] - 1]
      elif move == 'down':
            choice = [currentPos[0], currentPos[1] + 1]
      elif move == 'right':
            choice = [currentPos[0] + 1, currentPos[1]]
      else:
            choice = [currentPos[0] - 1, currentPos[1]]

      occupiedPositions = []

      for s in data['snakes']: # all snakes
              for c in s['coords']:
                  occupiedPositions.append(c)

      for s in range(data['width']): # north and south walls
            occupiedPositions.append([s, -1])
            occupiedPositions.append([s, data['height']])

        for s in range(data['height']): # east and west walls
              occupiedPositions.append([-1, s])
              occupiedPositions.append([data['width'], s])

        #if 'currentPos' not in kwargs:
              #occupiedPositions.append(checkEnclosure(data, snake, currentPos, occupiedPositions))

        if choice in occupiedPositions:
              return True
        else:
              return False

# Get an array of length 4 of the coordinates that define the defensive square: [top-left, top-right, bottom-right, bottom-left]
def getSqCorners(snake, closeFood):
      squareDim = getSqSideLen(getSnakeLen(snake))

      sX = snake['coords'][0][0]
      sY = snake['coords'][0][1]

      snakeHead = snake['coords'][0]

      dx = closeFood[0] - snakeHead[0]
      dy = closeFood[1] - snakeHead[1]

      if dx == 1:
            # food is right of head, closest corner is bottom left
            return [[sX,sY-squareDim+2], [sX+squareDim-1,sY-squareDim+2], [sX+squareDim-1, sY+1], [sX, sY+1]], 'up'
      elif dx == -1:
            # food is left of head, closest corner is top right
            return [[sX-squareDim+1, sY-1], [sX, sY-1], [sX, sY+squareDim-2], [sX-squareDim+1, sY+squareDim-2]], 'down'
      elif dy == 1:
            # food is below head, closest corner is top left
            return [[sX-1, sY], [sX+squareDim-2, sY], [sX+squareDim-2, sY+squareDim-1], [sX-1, sY+squareDim-1]], 'right'
      elif dy == -1:
            # food is above head, closest corner is bottom right
            return [[sX-squareDim+2, sY-squareDim+1], [sX+1, sY-squareDim+1], [sX+1, sY], [sX-squareDim+2, sY]], 'left'


# Get the move required to keep the snake in a defensive square formation around a food item
def getDefMove(snake, sqCorners):
      snakeHead = snake['coords'][0]
      direction = getDirection(snake)
      print "sqCorners in getDefMove: ", sqCorners
      print "snakeHead: ", snakeHead
      if snakeHead in sqCorners:
            return turnRight(direction)
      else:
            return direction

#TODO: replace w/ better logic
def getOffMove(snakeHead, closeFood):
      if snakeHead[0] > closeFood[0]:
            move = 'left'
      elif snakeHead[0] < closeFood[0]:
            move = 'right'
      elif snakeHead[1] > closeFood[1]:
            move = 'up'
      elif snakeHead[1] < closeFood[1]:
            move = 'down'
      return move

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


# Find the closest piece of food in relation to position
def closestFood(foodList, position):
      closestFood = None
      closestDist = 9999

      for food in foodList:
            dist = distance(food, position)
            if dist < closestDist:
                  closestFood = food
                  closestDist = dist

      return closestFood

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
