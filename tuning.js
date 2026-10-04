// The game's numbers and names live here.
// Change one, save the file, then refresh the game to see it.

export const tuning = {
  // The name of the game, shown on the browser tab.
  title: 'SquallLine',

  // How fast the car drives, in miles each second. Real cars are much slower:
  // this is game speed, so a chase does not take all afternoon.
  carMilesPerSecond: 0.4,

  // How many miles of map fit across the screen. Smaller zooms in.
  viewMiles: 15,

  // How many miles the territory is from one side to the other.
  // The car cannot drive past its edge.
  territoryMiles: 60,

  storm: {
    // The corners of the storm's path, from where it starts to where it ends.
    // Each is so many miles east (x) and north (y) of the middle of the
    // territory. A minus number means west or south.
    path: [
      { x: -30, y: -12 },
      { x: -8, y: 0 },
      { x: 10, y: 6 },
      { x: 30, y: 18 },
    ],

    // How fast the storm travels, in miles each second. At 0.22 it crosses
    // in about five minutes, and the car is about twice as fast.
    milesPerSecond: 0.22,

    // One line for each tornado: where along the path it touches down and
    // where it dies. 0 is the start of the path, 1 is the end, 0.5 is half
    // way. Add a line for another tornado. Keep them in order, with a gap
    // between one ending and the next starting.
    tornadoes: [
      { start: 0.25, end: 0.4 },
      { start: 0.6, end: 0.8 },
    ],

    // How long before a tornado the hook starts to grow, as a share of the
    // path. Bigger gives the player more warning.
    hookLead: 0.08,
  },
};
