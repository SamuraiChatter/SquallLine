// The game's numbers and names live here.
// Change one, save the file, then refresh the game to see it.

export const tuning = {
  // The name of the game, shown on the browser tab.
  title: 'SquallLine',

  // The studio that made the game, shown on the title screen. Never a real
  // person's name.
  studio: 'SamuraiChatter',

  // The money in the bank at the start of a new game, in dollars.
  startingBalance: 0,

  // How fast the car drives, in miles each second. Real cars are much slower:
  // this is game speed, so a chase does not take all afternoon.
  carMilesPerSecond: 0.4,

  // Where the car starts each day, as so many miles east (x) and north (y)
  // of the middle of the territory. A minus number means west or south. The
  // car is put on the road nearest to this spot. This one is in Norman.
  carStart: { x: 3.4, y: -1.9 },

  // How many miles of map fit across the screen. Smaller zooms in.
  viewMiles: 15,

  // How wide the minimap is, in pixels of the game screen, which is 1920
  // across. The minimap sits in the top right corner while driving and shows
  // the whole territory.
  minimapPixels: 300,

  // How the storm looks on the radar: on the map, the minimap and the dash
  // radar alike.
  radar: {
    // How big one square pixel of the radar picture is, in miles. Bigger is
    // blockier.
    pixelMiles: 0.2,

    // How strong the hook's echo is, in dBZ, the unit a radar reports rain
    // in. 20 is the lightest green, 35 turns yellow and 50 turns red. Smaller
    // makes the hook harder to spot.
    hookDbz: 40,

    // How much of the map the rain hides, in percent: under the lightest
    // rain, and under the hail core. Rain in between hides in between. 100
    // hides the roads completely.
    lightRainCovers: 35,
    heavyRainCovers: 75,

    // Where the radar stands, as so many miles east (x) and north (y) of the
    // middle of the territory. This is where the real Oklahoma City radar,
    // KTLX, is. Its beam turns round this spot.
    site: { x: 12.6, y: 5.7 },

    // How many seconds the beam takes to turn once. The radar picture only
    // changes where the beam passes over it, so a slower beam shows an older
    // storm. The hail, the wind and the tornado marker are never late.
    sweepSeconds: 5,

    // For a vehicle with the phased array radar: how far a real tornado's
    // hook has grown when the radar marks it with a red triangle. 0.85 is
    // 85% grown, a few seconds before it touches down. Smaller gives the
    // player more warning. A false alarm is never marked.
    vortexHook: 0.85,
  },

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

    // How many miles fit across the dash radar, for a vehicle that has one.
    // Smaller zooms it in.
    dashRadarMiles: 30,
  },

  // Storm spotters. While a storm's hook is at least half grown they call in
  // what they see, and each report leaves a ring on the map.
  spotters: {
    // How many seconds pass between one report and the next.
    everySeconds: 12,

    // How far a report's ring can be from where the tornado touches down, in
    // miles. Spotters are looking from a distance. 0 makes every report
    // exact.
    offMiles: 1,

    // How many seconds a report's ring stays on the map, fading as it goes.
    ringSeconds: 20,

    // How many seconds a report's words stay along the bottom of the screen.
    wordsSeconds: 6,

    // How far the hook has grown when spotters start to say "funnel cloud"
    // instead of "rotating wall cloud": 0.5 is half grown, 1 is fully grown.
    funnelCloudHook: 0.85,
  },

  // The TV station that buys the footage. Its name shows on the summary at
  // the end of the day.
  tvStation: 'Twister TV',

  tornado: {
    // How big the tornado's marker is on the map at each strength, from EF0
    // to EF5, in miles. A stronger tornado is a bigger one.
    mapMiles: [0.4, 0.5, 0.65, 0.8, 1, 1.2],
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

  // The chase days, in the order they are played. Add or take away a day by
  // adding or taking away a block. Each day has:
  //
  // stormFile: the name of a storm file saved from the design mode and put
  //   in the storms folder, such as 'my-storm.json'. Leave it empty ('') to
  //   use the path, tornadoes and false alarms typed in just below it
  //   instead. A storm file brings its own, and those typed here are ignored.
  // path: the corners of the storm's path, from where it starts to where it
  //   ends. Each is so many miles east (x) and north (y) of the middle of
  //   the territory. A minus number means west or south.
  // tornadoes: one line for each tornado: where along the path it touches
  //   down and where it dies, and its strength from 0 for EF0 to 5 for EF5.
  //   0 is the start of the path, 1 is the end, 0.5 is half way. Keep them
  //   in order, with a gap between one ending and the next starting.
  // falseAlarms: leave this out for a day with none. A false alarm is a
  //   stretch of the path where the hook grows, holds and then fades away
  //   with no tornado, so the player cannot trust every hook. One line for
  //   each, the same way as a tornado but with no strength: where along the
  //   path the hook is fully grown, and where it starts to fade. For example:
  //     falseAlarms: [{ start: 0.05, end: 0.12 }],
  //   A false alarm must not overlap a tornado or another false alarm. Leave
  //   a gap as long as storm.hookLead between a false alarm and the next
  //   tornado if the hook should fade away in between.
  // footage.ringMiles: how many miles out from the tornado the footage ring
  //   reaches. Footage shot from outside the ring pays nothing. 0 means the
  //   ring is the tornado itself, so nothing filmed from outside it pays.
  // footage.payAtEdge and payAtTornado: what one second of footage pays, in
  //   dollars: at the ring's edge, and right next to the tornado. In between
  //   pays in between.
  days: [
    // Day one.
    {
      stormFile: '',
      path: [
        { x: -28, y: -12 },
        { x: -8, y: 0 },
        { x: 10, y: 6 },
        { x: 28, y: 18 },
      ],
      tornadoes: [
        { start: 0.25, end: 0.4, strength: 0 },
        { start: 0.6, end: 0.8, strength: 0 },
      ],
      footage: { ringMiles: 6, payAtEdge: 20, payAtTornado: 200 },
    },
    // Day two.
    {
      stormFile: '',
      path: [
        { x: -25.4, y: -18.4 },
        { x: -7.4, y: -15.9 },
        { x: 6.6, y: -7.9 },
        { x: 22.6, y: -3.4 },
        { x: 28, y: -0.7 },
      ],
      tornadoes: [
        { start: 0.15, end: 0.28, strength: 1 },
        { start: 0.6, end: 0.75, strength: 1 },
      ],
      footage: { ringMiles: 5, payAtEdge: 30, payAtTornado: 300 },
    },
    // Day three.
    {
      stormFile: '',
      path: [
        { x: -1.4, y: -28.4 },
        { x: 5.6, y: -18.4 },
        { x: 16.6, y: -11.4 },
        { x: 24.6, y: -5.4 },
        { x: 27.6, y: 8.6 },
      ],
      tornadoes: [
        { start: 0.1, end: 0.25, strength: 2 },
        { start: 0.5, end: 0.7, strength: 2 },
      ],
      footage: { ringMiles: 4, payAtEdge: 45, payAtTornado: 450 },
    },
    // Day four.
    {
      stormFile: '',
      path: [
        { x: -25.4, y: -25.4 },
        { x: -17.4, y: -14.4 },
        { x: -14.4, y: -5.4 },
        { x: -7.4, y: 5.6 },
        { x: -3, y: 12 },
      ],
      tornadoes: [
        { start: 0.2, end: 0.4, strength: 3 },
        { start: 0.55, end: 0.8, strength: 3 },
      ],
      footage: { ringMiles: 3, payAtEdge: 70, payAtTornado: 700 },
    },
    // Day five.
    {
      stormFile: '',
      path: [
        { x: 14.6, y: -28.4 },
        { x: 17.6, y: -16.4 },
        { x: 22.1, y: -3.4 },
        { x: 23.6, y: 7.6 },
        { x: 28, y: 20 },
      ],
      tornadoes: [
        { start: 0.15, end: 0.4, strength: 4 },
        { start: 0.55, end: 0.85, strength: 4 },
      ],
      footage: { ringMiles: 2, payAtEdge: 100, payAtTornado: 1000 },
    },
    // Day six. The footage ring is the tornado itself.
    {
      stormFile: '',
      path: [
        { x: -25.4, y: -17.4 },
        { x: -9.4, y: -15.4 },
        { x: 5.6, y: -7.9 },
        { x: 16.6, y: -6.4 },
        { x: 28, y: -2 },
      ],
      tornadoes: [
        { start: 0.3, end: 0.75, strength: 5 },
      ],
      footage: { ringMiles: 0, payAtEdge: 2000, payAtTornado: 2000 },
    },
  ],

  wind: {
    // How fast the wind blows right at a tornado of each strength, from EF0
    // to EF5, in miles an hour. The roof wind gauge reads less the further
    // away the car is.
    mphAtTornado: [80, 100, 125, 150, 180, 220],

    // How many miles out from the tornado its wind dies away to nothing.
    reachMiles: 6,

    // What science pays, in dollars, for each mile an hour of the day's top
    // wind on the roof gauge. At 10, a reading of 150 pays $1,500.
    bonusPerMph: 10,
  },

  anchor: {
    // How many seconds the skirts and spikes take to go down, and to come
    // back up. The car cannot drive until they are up.
    downSeconds: 2,
    upSeconds: 2,
  },

  // The sound: wind, hail, debris hitting the car, and the camera's beep. The
  // game makes them all itself. M switches the sound off and on.
  sound: {
    // How loud the whole game is: 1 is full, 0 is silent.
    loudness: 0.8,

    // How loud the wind is with no tornado near, against 1 for the wind right
    // at a tornado. 0 is no wind at all until a tornado is close. The wind
    // grows from here as the car closes in, starting wind.reachMiles out.
    breeze: 0.1,

    // How much of the wind and hail gets inside the car while driving,
    // against 1 for standing outside to film. 0.4 is less than half as loud.
    // It is muffled as well.
    inCarLoudness: 0.4,

    // Sounds of your own, to play in place of the game's. Put the recording
    // in the sounds folder and type its name between the quotes, such as
    // 'wind.mp3'. Leave the quotes empty ('') to keep the game's sound. Wind
    // and hail play round and round, so record a few seconds with no clear
    // start or end; thud and beep play once each time.
    files: { wind: '', hail: '', thud: '', beep: '' },
  },

  // The music, heard only while driving: a night drive in the rain. Far from
  // the storm it is a low drone and crackle. As the car closes in a shuffling
  // beat comes in, then gets busier and brighter, and a heartbeat thump joins
  // close to the tornado. With no tornado on the ground it follows the
  // storm's hook, and builds only half way.
  music: {
    // How loud the music is, against 1 for the wind right at a tornado. Keep
    // it low enough to sit under the wind and hail.
    loudness: 0.5,

    // How many miles from the tornado the music starts to build, and how
    // close the car must be for it to be at its fullest.
    startMiles: 12,
    peakMiles: 1.5,
  },

  // The choices on the menus and screens, which can be tapped with a finger
  // or clicked with a mouse. Sizes are in pixels of the game picture, which
  // is 1920 wide and 1080 tall.
  choices: {
    // How tall the box round each choice is, and the narrowest it can be.
    // On the smallest iPad 84 comes out the size of a fingertip: smaller
    // boxes are hard to hit.
    tall: 84,
    narrowest: 420,
    // On the free play screen: how big each day's tile is, and the gap
    // between one tile and the next.
    dayTile: 140,
    dayGap: 30,
  },

  // The smallest any words in the game picture may come out on the screen,
  // in pixels of the screen. The picture shrinks to fit a small screen, and
  // on a phone its small print would be too small to read: there, words
  // that would come out smaller than this are painted bigger. A computer
  // or an iPad is big enough that nothing changes.
  smallestTextPixels: 12,

  // The touch controls shown during a chase to a player using a finger: a
  // joystick on the left and buttons on the right. A keyboard player never
  // sees them. Sizes here are in pixels of the screen, not of the game
  // picture.
  touch: {
    // How wide the joystick is. On an iPad it sits in a strip under the
    // picture that is about 150 tall, so much bigger will not fit.
    stickPixels: 128,
    // How far from its middle the joystick must be pushed before the car
    // moves, as a share of the way to its edge. It stops a resting thumb
    // from creeping the car along. 0.2 is a fifth of the way.
    stickDeadShare: 0.2,
    // How tall each button is.
    buttonPixels: 60,
    // On a phone, which is much shorter than an iPad, the joystick and the
    // buttons are smaller and sit over the edges of the picture. These are
    // their sizes there, and how solid they are: 1 hides the picture behind
    // them, 0 makes them invisible.
    phoneStickPixels: 108,
    phoneButtonPixels: 44,
    phoneSolid: 0.6,
    // What a touch player is told while the device is held upright. The
    // game waits until it is turned on its side.
    turnWords: 'Turn your device on its side to play.',
    // What the buttons say. Film turns into driveOn while filming, and
    // anchor into pullUp once the skirts are going down.
    names: {
      film: 'Film',
      driveOn: 'Drive on',
      anchor: 'Anchor',
      pullUp: 'Pull up',
      radar: 'Radar',
      map: 'Map',
      pause: 'Pause',
    },
  },

  // The chase team and its vehicle. Their names show in the garage.
  team: 'Team SquallLine',
  vehicle: 'The Chaser',

  // The parts the garage sells, in the order they are listed. Each part is
  // bought once. Add a part by adding a block. Each part has:
  //
  // id: what a saved game remembers the part by. Never change one, or saved
  //   games lose the part.
  // name, price: what the garage calls it, and what it costs in dollars.
  // does: what the garage says it does.
  // needs: the id of a part that has to be bought first, or '' for none.
  // picture: the picture file drawn on the vehicle once the part is owned.
  // at: where on the vehicle the picture goes: 0 is the left or the top of
  //   the vehicle's picture, 1 is the right or the bottom, 0.5 is the middle.
  //
  // Then what the part does to the game, with one or more of these. "Times"
  // means multiply: 2 doubles a number, 0.5 halves it, 0 takes it away.
  //
  // hailDamageTimes: how much hail damage gets through.
  // payTimes: how much more footage pays.
  // speedTimes: how much faster the car drives.
  // debrisDamageTimes: how much of each debris strike gets through.
  // dangerRingTimes: how big the danger ring is.
  // flipDamage: with this, a flip fills this much of the damage meter
  //   instead of ending the day. 0.5 is half the meter.
  // anchoredRingTimes: with this the vehicle can anchor (A, while parked),
  //   and this is how big the danger ring is while it is anchored.
  // anchorHolds: with this, an anchored vehicle stays put when the tornado
  //   passes right over it, and films from inside.
  // dashRadar: with this, a small radar stays on screen while filming.
  // windGauge: with this, the day's top wind is recorded and the summary
  //   pays a science bonus for it.
  // viewfinderTimes: how wide the viewfinder box is.
  // sweepTimes: how much faster the radar's beam turns, so the radar picture
  //   is less out of date.
  // radarMarks: with this, the radar marks a storm's rotation with a yellow
  //   circle, false alarms too, and a real tornado that is about to touch
  //   down or is on the ground with a red triangle.
  // offRoad: with this, the vehicle leaves the roads: the arrows drive it
  //   any way at all, across fields and roads alike, at its normal speed.
  parts: [
    {
      id: 'lexan',
      name: 'Lexan windows',
      price: 1500,
      does: 'Hail no longer damages the vehicle.',
      needs: '',
      picture: 'art/part-lexan.png',
      at: { x: 0.45, y: 0.3 },
      hailDamageTimes: 0,
    },
    {
      id: 'camera',
      name: 'Better camera',
      price: 2500,
      does: 'Footage pays half as much again.',
      needs: '',
      picture: 'art/part-camera.png',
      at: { x: 0.45, y: 0.08 },
      payTimes: 1.5,
    },
    {
      id: 'engine',
      name: 'Bigger engine',
      price: 2000,
      does: 'The car drives a quarter faster.',
      needs: '',
      picture: 'art/part-engine.png',
      at: { x: 0.85, y: 0.5 },
      speedTimes: 1.25,
    },
    {
      id: 'armour',
      name: 'Steel armour',
      price: 5000,
      does: 'Debris does much less damage and the danger ring shrinks.',
      needs: '',
      picture: 'art/part-armour.png',
      at: { x: 0.45, y: 0.62 },
      debrisDamageTimes: 0.3,
      dangerRingTimes: 0.6,
    },
    {
      id: 'rollcage',
      name: 'Roll cage and harnesses',
      price: 4000,
      does: 'A flip costs heavy damage instead of ending the day.',
      needs: '',
      picture: 'art/part-rollcage.png',
      at: { x: 0.15, y: 0.3 },
      flipDamage: 0.5,
    },
    {
      id: 'skirts',
      name: 'Drop skirts',
      price: 6000,
      does: 'Press A while parked to anchor. The danger ring shrinks a lot.',
      needs: '',
      picture: 'art/part-skirts.png',
      at: { x: 0.45, y: 0.9 },
      anchoredRingTimes: 0.15,
    },
    {
      id: 'spikes',
      name: 'Anchor spikes',
      price: 8000,
      does: 'Anchored, the tornado can pass right over. Film from inside!',
      needs: 'skirts',
      picture: 'art/part-spikes.png',
      at: { x: 0.8, y: 0.9 },
      anchorHolds: true,
    },
    {
      id: 'radar',
      name: 'Dash radar',
      price: 3000,
      does: 'A small radar stays on screen while you film.',
      needs: '',
      picture: 'art/part-radar.png',
      at: { x: 0.8, y: 0.3 },
      dashRadar: true,
    },
    {
      id: 'gauge',
      name: 'Roof wind gauge',
      price: 3500,
      does: 'Records the top wind of the day. Science pays a bonus for it.',
      needs: '',
      picture: 'art/part-gauge.png',
      at: { x: 0.15, y: 0.08 },
      windGauge: true,
    },
    {
      id: 'turret',
      name: 'Filming turret',
      price: 3000,
      does: 'A wider viewfinder box, so the tornado is easier to keep in.',
      needs: '',
      picture: 'art/part-turret.png',
      at: { x: 0.8, y: 0.08 },
      viewfinderTimes: 1.6,
    },
    {
      id: 'phased',
      name: 'Phased array radar',
      price: 7000,
      does: 'A radar five times faster, which marks rotation and tornadoes.',
      needs: '',
      picture: 'art/part-phased.png',
      at: { x: 0.15, y: 0.62 },
      sweepTimes: 5,
      radarMarks: true,
    },
    {
      id: 'tires',
      name: 'Off-road tires',
      price: 10000,
      does: 'Leave the roads behind. Drive any way, across fields and all.',
      needs: '',
      picture: 'art/part-tires.png',
      at: { x: 0.15, y: 0.9 },
      offRoad: true,
    },
  ],

  // What every day's storm has in common.
  storm: {
    // How fast the storm travels, in miles each second. At 0.22 it crosses
    // in about five minutes, and the car is about twice as fast.
    milesPerSecond: 0.22,

    // How long before a tornado the hook starts to grow, as a share of the
    // path. Bigger gives the player more warning.
    hookLead: 0.08,
  },

  design: {
    // How far each kind of place reaches from its middle, in miles. The
    // design mode warns when a tornado's path comes this close to one,
    // because tornado paths stay over open country.
    townMiles: { city: 4, town: 1.5, village: 0.5 },
  },
};
