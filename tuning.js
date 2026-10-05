// The game's numbers and names live here.
// Change one, save the file, then refresh the game to see it.

export const tuning = {
  // The name of the game, shown on the browser tab.
  title: 'SquallLine',

  // How fast the car drives, in miles each second. Real cars are much slower:
  // this is game speed, so a chase does not take all afternoon.
  carMilesPerSecond: 0.4,

  // Where the car starts each day, as so many miles east (x) and north (y)
  // of the middle of the territory. A minus number means west or south. The
  // car is put on the road nearest to this spot. This one is in Norman.
  carStart: { x: 3.4, y: -1.9 },

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

  danger: {
    // How many miles out from the tornado the danger ring reaches. Inside it
    // the wind damages the car. Armour will shrink this later.
    ringMiles: 2.5,

    // How hard the wind hits right at the tornado, as how much of the damage
    // meter it would fill each second. Bigger hurts more. Further out it is
    // much gentler: half way to the ring's edge does a quarter of this.
    windDamageAtTornado: 0.5,

    // Closer to the tornado than this many miles, the car flips.
    flipMiles: 0.4,

    // What it costs, in dollars, to repair a completely wrecked car. Half
    // the damage costs half as much.
    fullRepairCost: 800,
  },

  debris: {
    // How many miles out from the tornado debris flies. A little wider than
    // the tornado itself.
    zoneMiles: 0.9,

    // Inside the debris zone, something hits the car this often, in seconds.
    strikeEverySeconds: 0.8,

    // How much of the damage meter each strike fills. 0.06 is about a
    // sixteenth.
    damagePerStrike: 0.06,
  },

  hail: {
    // The size of the hail core, the purple middle of the storm on the
    // radar: how many miles it reaches along its length, and across it.
    coreMilesLong: 1.5,
    coreMilesWide: 1,

    // How much of the damage meter hail fills each second inside the core.
    damagePerSecond: 0.03,
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
