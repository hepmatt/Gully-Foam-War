# Gully Foam War

A first-person foam, paintball and airsoft blaster game that runs in the browser. Fight masked scouts across The Creek, the Abandoned City and the Office Tower. Tag them for cash, smash cover to find power-ups, and buy out the supply shop to build the ultimate golden weapon.

## Play it

Open `index.html` in a browser. Everything except the two Google fonts is in the repo, so it also works offline.

To put it online with GitHub Pages:

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Source**, pick **Deploy from a branch**, choose `main` and `/ (root)`, then save.
4. The game appears at `https://<your-username>.github.io/<repo-name>/` after a minute or two.

## Project layout

| Path | What it is |
|---|---|
| `index.html` | Page markup and script loading order |
| `css/style.css` | All page and HUD styling |
| `js/game.js` | Game logic: levels, enemies, weapons, shop, sound, input |
| `js/graphics.js` | Graphics layer: post-processing, sky, textures, shadows, particles |
| `vendor/three/` | three.js r128 and the post-processing add-ons it uses (MIT license) |

`graphics.js` is optional. If it is missing or fails to load, `game.js` falls back to the plain renderer, so graphics work can't break the game itself.

## Graphics presets

Players choose a preset on the main menu or with the Graphics button during play. The choice is saved in the browser.

| Preset | What it turns on |
|---|---|
| Low | Original look, 1024 shadows, no post-processing. For older laptops and phones. |
| Medium | Surface textures, animated cloudy sky, color grading, FXAA anti-aliasing, 2048 shadows that follow the player, ambient particles |
| High | Everything in Medium, plus HDR bloom so enemy eyes, lights, coins, lasers and explosions glow, and twice the particles |

Per-level color grades: The Creek is warm and saturated, the Abandoned City is cool and washed out, and the Office Tower is neutral. Boss waves pull every level toward a dark red grade with a heavier vignette.

## Graphics roadmap

Ideas for the next passes, roughly in order of payoff:

1. **Ambient occlusion** with `SAOPass` or `SSAOPass` from `three/examples/js/postprocessing`, to ground objects in contact shadows.
2. **Real textures** in `assets/textures/`, loaded with `THREE.TextureLoader` in place of the canvas-generated ones in `graphics.js` (`tex()` is the one place to swap).
3. **Modeled characters** as glTF files in `assets/models/`, loaded with `GLTFLoader`, replacing the box-and-cylinder scout rigs.
4. **Water shader** for the creek, using `examples/js/objects/Water.js`.
5. **Upgrade three.js** from r128 to a current release with ES modules and a build tool such as Vite. This is the biggest change: lighting and color management work differently in newer versions, so every material needs retuning.
