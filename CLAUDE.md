# SquallLine

A storm-chasing game for the browser. It is plain HTML, CSS and JavaScript
modules: no framework, no build step and nothing to install beyond Node.

GitHub Pages publishes `main` at https://samuraichatter.github.io/SquallLine/.

## Run and test

- `npm start` serves the game at http://localhost:8000 with caching off. Save a
  file, then refresh the page.
- `npm test` runs the tests with Node's built-in runner. The same command runs
  on every PR.

## The creative lead's files

`tuning.js` and everything in `art/`, `sounds/` and `storms/` belong to the
creative lead.

- `tuning.js` holds the game's numbers and names. A number or name that
  changes how the game plays or reads goes there, not in the code, with a
  comment in plain language.
- Do not change a value already in `tuning.js`, or anything in `art/`,
  `sounds/` or `storms/`, unless asked.

## Code

- `src/rules.js` holds the rules: plain functions from one game state to the
  next. They never touch the canvas or the page, so they run under Node, which
  is where the tests check them.
- `src/roads.js` holds the road network and how the car drives along it. Like
  the rules, it never touches the canvas or the page, and has its own tests.
- `src/freeways.js` turns the map's freeways into roads the car can drive:
  one line for each freeway instead of two, no ramps, and one junction at each
  interchange. The map still draws the freeways and ramps as they are. It
  never touches the canvas or the page either, and has its own tests.
- `src/radar.js` holds the radar's pictures: how hard it is raining and how
  the wind is blowing at any spot near a storm, and the colours a radar gives
  them. It never touches the canvas
  or the page either, and has its own tests.
- `src/scene.js` holds the sums behind the filming view's scenery: how dark
  the sky is in each direction, how the trees move in the wind, the shape
  of the tornado, and how much rain and hail falls. It never
  touches the canvas or the page either, and has its own tests.
- `src/taps.js` holds what can be tapped or clicked: where each choice on a
  screen sits in the game picture, and what it reads as for a keyboard or a
  touch player. It never touches the canvas or the page either, and has its
  own tests. A tap or click on a choice does what its key does. It also
  holds the sums behind the touch controls: which way the joystick steers,
  and which buttons a chase shows.
- `src/mix.js` holds the sums behind the sound: how loud the wind and hail
  are at any moment, and whether footage is counting. It never touches the
  canvas or the page either, and has its own tests. `src/sound.js` makes the
  sound itself, in the browser, with no sound files. A recording in `sounds/`
  plays in place of one of the game's sounds when `tuning.js` names it.
- `src/controls.js` is the touch controls themselves: the joystick and the
  buttons in `index.html`, laid over the game during a chase for a player
  using a finger. Each button does what its key does.
- `src/draw.js` paints the map view, `src/windshield.js` the filming view, and
  `src/hud.js` the money, damage meter, pause screen and day summary over
  both, and the title screen, briefing and final score around them.
  `src/garage.js` paints the garage, where parts are bought between days.
  `src/map.js` loads the real map. `src/main.js` starts the game.
- `design.html` and `src/design.js` are the design mode, where the creative
  lead draws storms on the map. Players are not shown it: nothing in the game
  links to it. `src/storms.js` holds its sums and reads and writes storm
  files, and has tests.
- `storms/` holds the storm files saved from the design mode. Each day in
  `tuning.js` has a `stormFile` that names the one it uses.
- The picture is always 1920 by 1080 and shrinks to fit the window. On a
  phone that would make small print unreadable, so `src/main.js` raises any
  font that would come out smaller than `smallestTextPixels` in `tuning.js`.
  Painting code asks for the size it wants on a computer; a screen that has
  to fit a phone checks that its layout still holds with bigger small print,
  as the garage does.
- Types are JSDoc comments. The editor checks them through `jsconfig.json`.
- Paths in the page are relative, and a file's name is spelled the same way
  everywhere, capitals included. Pages serves the game from `/SquallLine/` and
  tells `Car.png` and `car.png` apart.

## Public repo

- Credits use the studio name, never a real name.
- There is no licence file, on purpose: the code and art are all rights
  reserved.
