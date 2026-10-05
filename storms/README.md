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
