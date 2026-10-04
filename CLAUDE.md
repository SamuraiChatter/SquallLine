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

`tuning.js` and everything in `art/` belong to the creative lead.

- `tuning.js` holds the game's numbers and names. A number or name that
  changes how the game plays or reads goes there, not in the code, with a
  comment in plain language.
- Do not change a value already in `tuning.js`, or anything in `art/`, unless
  asked.

## Code

- `src/rules.js` holds the rules: plain functions from one game state to the
  next. They never touch the canvas or the page, so they run under Node, which
  is where the tests check them.
- `src/draw.js` paints the canvas. `src/main.js` starts the game.
- Types are JSDoc comments. The editor checks them through `jsconfig.json`.
- Paths in the page are relative, and a file's name is spelled the same way
  everywhere, capitals included. Pages serves the game from `/SquallLine/` and
  tells `Car.png` and `car.png` apart.

## Public repo

- Credits use the studio name, never a real name.
- There is no licence file, on purpose: the code and art are all rights
  reserved.
