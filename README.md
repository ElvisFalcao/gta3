# Mother City

A small, original, browser-playable 3D mobile game prototype set in a fictional Cape Town neighbourhood. It is a static GitHub Pages app built with Three.js; there is no build step.

## Play

Open the GitHub Pages site in a modern browser with WebGL. On desktop, move with **WASD** or the **arrow keys**. On touchscreens, use the directional pad and the context-aware run, jump, punch, car, gas, and brake buttons. Tap a character directly in the scene to start a conversation, or walk near them and use the **Talk** button. The first character, Aunty Zanele, is beside the player at the start.

### Xbox-style controller

- Left stick: walk or steer; right stick: camera; click right stick: camera behind player.
- **A** sprint / confirm, **B** punch / back, **X** jump, **Y** enter or leave a taxi.
- **LB** talk / interact, **RB** handbrake, **RT / LT** punch on foot / accelerate and brake in a taxi.
- Click left stick for the horn. D-pad left plays radio, down starts a taxi shift, and up/down picks dialogue choices. **View** opens the map and **Menu** pauses.
- The on-screen controls hide while a gamepad is active. Open **XBOX CONTROLS** for the layout and cycle street voices through voices, bubbles, and off.

The game can be installed from supported browsers. Its service worker caches the app and Three.js engine for offline launches after the first online visit. Story chapter, respect, radio progress, free-time count, and voice preference save in this browser.

## Prototype loop

- Explore Salt River’s streets, shops, community garden, and Cape Town mountain and coast scenery.
- Follow a mystery about missing community garden title deeds through conversations with local characters.
- Choose how Thabo builds trust and gathers information. Earn respect along the way.
- Visit Harbour Street Gym or Sea Point Promenade for optional free-time activities.
- Keep roaming after completing the chapter.

The neighbourhood and events are fictionalized. The 3D world is built from simple shapes in Three.js; no external game art or models are used. The Three.js engine is vendored for offline use; see [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).

