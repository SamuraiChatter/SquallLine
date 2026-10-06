# Storms

Storm files saved from the design mode go in this folder.

1. Open the design mode: `design.html`, next to the game's own page
   (http://localhost:8000/design.html while `npm start` is running).
2. Draw the storm, give it a name and press Save. The browser puts the file
   in its downloads folder.
3. Move the file into this folder.
4. In `tuning.js`, find the day the storm is for and set its `stormFile` to
   the file's name, such as `'my-storm.json'`. Spell it exactly as the file
   is spelled, capitals included.

A storm file holds the corners of the storm's path, and where along the path
each tornado touches down and dies, with its strength from EF0 to EF5. The
storm's speed and how early the hook grows stay in `tuning.js`.

## False alarms

A false alarm is a stretch of the path where the hook grows, holds and then
fades away with no tornado. On the radar it looks just like the run-up to a
real tornado.

The design mode cannot draw them yet, so they are typed into the storm file
by hand. Open the file in a text editor and add a `falseAlarms` list beside
`tornadoes`:

```json
{
  "path": [{ "x": -28, "y": -12 }, { "x": 28, "y": 18 }],
  "tornadoes": [{ "start": 0.6, "end": 0.8, "strength": 2 }],
  "falseAlarms": [{ "start": 0.2, "end": 0.3 }]
}
```

- `start` is where along the path the hook is fully grown, and `end` is where
  it starts to fade: 0 is the start of the path, 1 is the end, as for a
  tornado. A false alarm has no strength.
- Keep them in order along the path.
- A false alarm must not overlap a tornado or another false alarm. The game
  will not load a storm file that breaks this, and says why on the screen.
- A file with no `falseAlarms` plays as it always did.

Loading a storm into the design mode and saving it again keeps its false
alarms.
