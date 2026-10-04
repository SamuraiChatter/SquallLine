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

  // How many miles the territory is from west to east, and from south to
  // north. The car cannot drive past its edge. These match the real map in
  // data/map.json, so they only change when the map is baked again.
  territoryMilesWide: 56.5,
  territoryMilesTall: 62,

  camera: {
    // How much of the world fits across the windshield, in degrees. A full
    // turn is 360. Smaller zooms the view in.
    viewDegrees: 70,

    // How wide the viewfinder box is, in degrees. Footage only counts while
    // the tornado is inside it. Smaller makes filming harder.
    viewfinderDegrees: 16,

    // How fast left and right swing the camera, in degrees each second.
    panDegreesPerSecond: 35,
  },

  // The TV station that buys the footage. Its name shows on the summary at
  // the end of the day.
  tvStation: 'Twister TV',

  footage: {
    // How many miles out from the tornado the footage ring reaches. Footage
    // shot from outside the ring pays nothing.
    ringMiles: 6,

    // What one second of footage pays, in dollars: at the ring's edge, and
    // right next to the tornado. In between pays in between.
    payAtEdge: 20,
    payAtTornado: 200,
  },

  storm: {
    // The corners of the storm's path, from where it starts to where it ends.
    // Each is so many miles east (x) and north (y) of the middle of the
    // territory. A minus number means west or south.
    path: [
      { x: -28, y: -12 },
      { x: -8, y: 0 },
      { x: 10, y: 6 },
      { x: 28, y: 18 },
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
