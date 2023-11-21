import { BoardSetup, Coordinate, Goal, Tile } from "../lib/types.ts";
import { MessageToPlayer } from "../lib/types.ts";

const b1 = () => {
  const rightWallCoord: Coordinate[] = [
      { x: 3, y: 0 },
      { x: 10, y: 0 },
      { x: 8, y: 1 },
      { x: 5, y: 2 },
      { x: 14, y: 2 },
      { x: 2, y: 4 },
      { x: 10, y: 4 },
      { x: 6, y: 5 },
      { x: 0, y: 6 },
      { x: 11, y: 6 },
      { x: 3, y: 9 },
      { x: 7, y: 10 },
      { x: 12, y: 10 },
      { x: 0, y: 11 },
      { x: 10, y: 11 },
      { x: 6, y: 12 },
      { x: 13, y: 12 },
      { x: 1, y: 14 },
      { x: 9, y: 14 },
      { x: 5, y: 15 },
      { x: 11, y: 1 },
    ],
    bottomWallCoord: Coordinate[] = [
      { x: 9, y: 1 },
      { x: 14, y: 1 },
      { x: 5, y: 2 },
      { x: 2, y: 3 },
      { x: 0, y: 4 },
      { x: 10, y: 4 },
      { x: 15, y: 4 },
      { x: 1, y: 5 },
      { x: 7, y: 5 },
      { x: 12, y: 5 },
      { x: 3, y: 8 },
      { x: 15, y: 8 },
      { x: 8, y: 9 },
      { x: 13, y: 9 },
      { x: 1, y: 11 },
      { x: 10, y: 11 },
      { x: 6, y: 12 },
      { x: 14, y: 12 },
      { x: 0, y: 13 },
      { x: 2, y: 13 },
      { x: 9, y: 13 },
    ],
    goals: Goal[] = [
      { color: "g", shape: "star", coord: { x: 9, y: 1 } },
      { color: "u", shape: "star", coord: { x: 5, y: 2 } },
      { color: "y", shape: "star", coord: { x: 3, y: 9 } },
      { color: "r", shape: "star", coord: { x: 13, y: 10 } },
      { color: "g", shape: "crescent", coord: { x: 2, y: 4 } },
      { color: "y", shape: "crescent", coord: { x: 14, y: 2 } },
      { color: "r", shape: "crescent", coord: { x: 1, y: 11 } },
      { color: "u", shape: "crescent", coord: { x: 9, y: 14 } },
      { color: "g", shape: "planet", coord: { x: 10, y: 11 } },
      { color: "r", shape: "planet", coord: { x: 10, y: 4 } },
      { color: "y", shape: "planet", coord: { x: 1, y: 6 } },
      { color: "u", shape: "planet", coord: { x: 6, y: 12 } },
      { color: "g", shape: "gear", coord: { x: 2, y: 14 } },
      { color: "r", shape: "gear", coord: { x: 7, y: 5 } },
      { color: "u", shape: "gear", coord: { x: 12, y: 6 } },
      { color: "y", shape: "gear", coord: { x: 14, y: 12 } },
      { color: "m", shape: "vortex", coord: { x: 8, y: 10 } },
    ],
    tiles = dflt(),
    messages: MessageToPlayer[] = [];

  for (const c of rightWallCoord) {
    tiles[c.x][c.y].right_wall = true;
    messages.push({
      category: "wall_pos",
      coord: {
        x: c.x,
        y: c.y,
      },
      right_wall: true,
    });
  }
  for (const c of bottomWallCoord) {
    tiles[c.x][c.y].bottom_wall = true;
    messages.push({
      category: "wall_pos",
      coord: {
        x: c.x,
        y: c.y,
      },
      bottom_wall: true,
    });
  }
  for (const g of goals) {
    tiles[g.coord.x][g.coord.y].goal = g;
    messages.push({
      category: "goal_pos",
      coord: {
        x: g.coord.x,
        y: g.coord.y,
      },
      goal_color: g.color,
      goal_shape: g.shape,
    });
  }

  return { tiles, goals, messages };
};

function dflt(): Tile[][] {
  const size = 16;
  const tiles: Tile[][] = [];

  for (let x = 0; x < size; x++) {
    const newRow: Tile[] = [];
    for (let y = 0; y < size; y++) {
      newRow.push({
        right_wall: false,
        bottom_wall: false,
        robot: null,
        goal: null,
        coord: {
          x: x,
          y: y,
        },
      });
    }

    tiles.push(newRow);
  }

  tiles[6][7].right_wall = true;
  tiles[6][8].right_wall = true;
  tiles[7][6].bottom_wall = true;
  tiles[7][8].bottom_wall = true;
  tiles[8][6].bottom_wall = true;
  tiles[8][8].bottom_wall = true;
  tiles[8][7].right_wall = true;
  tiles[8][8].right_wall = true;

  return tiles;
}

export const setup: (() => BoardSetup)[] = [b1];
