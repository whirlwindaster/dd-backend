import {
  Coordinate,
  Direction,
  Goal,
  RobotColor,
  RobotPositions,
  Tile,
} from "../lib/types.ts";
import { setup } from "./boardsetter.ts";

export default class Board {
  size = 16;
  tiles: Tile[][];
  goals: Goal[];
  right_walls: Coordinate[];
  bottom_walls: Coordinate[];
  current_positions: RobotPositions = {
    r: { x: 0, y: 0 },
    y: { x: 0, y: 0 },
    g: { x: 0, y: 0 },
    u: { x: 0, y: 0 },
    b: { x: 0, y: 0 },
  };
  saved_positions: RobotPositions;

  constructor(setup_num: number) {
    ({
      tiles: this.tiles,
      goals: this.goals,
      rightWallCoords: this.right_walls,
      bottomWallCoords: this.bottom_walls,
    } = setup[setup_num - 1]());

    this.populateRobots();
    this.saved_positions = { ...this.current_positions };
  }

  populateRobots() {
    let key: keyof RobotPositions;
    for (key in this.current_positions) {
      let x = Math.floor(Math.random() * this.size),
        y = Math.floor(Math.random() * this.size),
        c: Coordinate = { x, y };

      while (!this.isSpotAvailable(c)) {
        x = Math.floor(Math.random() * this.size);
        y = Math.floor(Math.random() * this.size);
        c = { x, y };
      }

      this.current_positions[key] = { ...c };
      this.tiles[c.x][c.y].robot = key; // this feels sus
    }
  }

  saveRobotPositions() {
    this.saved_positions = { ...this.current_positions };
  }

  resetRobotPositions() {
    let key: keyof RobotPositions;
    for (key in this.current_positions) {
      this.tiles[this.current_positions[key].x][this.current_positions[key].y]
        .robot = null;
    }
    this.current_positions = { ...this.saved_positions };
    for (key in this.current_positions) {
      this.tiles[this.current_positions[key].x][this.current_positions[key].y]
        .robot = key;
    }

    return this.current_positions;
  }

  isSpotAvailable(c: Coordinate): boolean {
    if (
      this.tiles[c.x][c.y].robot || this.tiles[c.x][c.y].goal ||
      this.isCenterSquare(c)
    ) {
      return false;
    }

    const left_bound: boolean = c.x === 0;
    const up_bound: boolean = c.y === 0;

    // literally no idea what this does LOL
    return !(this.tiles[c.x][c.y].bottom_wall &&
      this.tiles[c.x][c.y].right_wall &&
      // tries to prevent from going out of bounds
      !(!left_bound && !this.tiles[c.x - 1][c.y].right_wall) &&
      !(!up_bound && !this.tiles[c.x][c.y - 1].bottom_wall));
  }

  isCenterSquare(c: Coordinate): boolean {
    return (this.size / 2 - 1 <= c.x && c.x <= this.size / 2) &&
      (this.size / 2 - 1 <= c.y && c.y <= this.size / 2);
  }

  getDestinationTile(direction: Direction, c: Coordinate): Tile {
    switch (direction) {
      case "up": {
        for (let i = c.y - 1; i >= 0; i--) {
          if (this.tiles[c.x][i].bottom_wall || this.tiles[c.x][i].robot) {
            return this.tiles[c.x][i + 1];
          }
        }

        return this.tiles[c.x][0];
      }

      case "left": {
        for (let i = c.x - 1; i >= 0; i--) {
          if (this.tiles[i][c.y].right_wall || this.tiles[i][c.y].robot) {
            return this.tiles[i + 1][c.y];
          }
        }

        return this.tiles[0][c.y];
      }

      case "down": {
        for (let i = c.y + 1; i < this.size; i++) {
          if (this.tiles[c.x][i].robot) {
            return this.tiles[c.x][i - 1];
          } else if (this.tiles[c.x][i].bottom_wall) {
            return this.tiles[c.x][i];
          }
        }

        return this.tiles[c.x][this.size - 1];
      }

      case "right": {
        for (let i = c.x + 1; i < this.size; i++) {
          if (this.tiles[i][c.y].robot) {
            return this.tiles[i - 1][c.y];
          } else if (this.tiles[i][c.y].right_wall) {
            return this.tiles[i][c.y];
          }
        }

        return this.tiles[this.size - 1][c.y];
      }
    }
  }

  moveRobot(robot: RobotColor, direction: Direction): Coordinate | null {
    const destination_tile = this.getDestinationTile(
      direction,
      this.current_positions[robot],
    );
    if (
      this.current_positions[robot].x === destination_tile.coord.x &&
      this.current_positions[robot].y === destination_tile.coord.y
    ) {
      return null;
    }
    this.tiles[this.current_positions[robot].x][this.current_positions[robot].y]
      .robot = null;
    destination_tile.robot = robot;
    this.current_positions[robot] = { ...destination_tile.coord };
    return { ...destination_tile.coord };
  }

  isSolved(): boolean {
    const robot_on_goal_tile = this
      .tiles[this.goals[0].coord.x][this.goals[0].coord.y]
      .robot;

    if (robot_on_goal_tile) {
      if (this.goals[0].color === "m") {
        return true;
      }
      return (this.goals[0].color === robot_on_goal_tile);
    }
    return false;
  }
}
