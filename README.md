# GALAGA · PIXEL ARCADE

Play: https://deviankim.github.io/galaga/

A dependency-free browser recreation of Galaga-style arcade play. The original
ROM, sprite sheets, recordings, and music files are not included. Graphics,
flight paths, and arcade-style sounds are implemented here rather than emulated.
This is not a frame-accurate or bit-identical port of the original game.

## Controls

- Arrow keys / A and D: move. Space / Z: fire. Enter or START: start.
- P / Escape: pause and resume. M: mute. Switching tabs automatically pauses.
- Mobile: hold left/right and FIRE simultaneously, or drag on the playfield to move.
- The separate **도킹 연습** button starts a one-boss docking practice session.
  Practice scores do not change the saved high score. Reload to leave a session.

## Arcade rules implemented

- A fixed 224 × 288 canvas, nearest-neighbor scaling, hand-authored animated
  pixel sprites, bitmap text, black starfield, 1UP/high-score HUD, spare fighters
  and stage flags. Resizing never changes the simulation coordinate system.
- Five scheduled eight-enemy groups, totaling 4 bosses, 16 red butterflies and
  20 blue/yellow bees. Group composition, entry timing, mirrored looping paths,
  and formation slots are explicit rather than randomly spawned. The paths are
  reconstructed curves, not the original ROM's exact stage tables.
- Two active shot volleys: two bullets maximum for a single fighter and two
  parallel pairs for a dual fighter. Boss armor changes from green to purple
  after one hit; the second hit destroys it.
- Formation / flying scores: bee 50 / 100; butterfly 80 / 160;
  boss 150 / 400. Defeating one or two escorts before the diving boss raises
  its score to 800 or 1600. Three fighters initially, with extra fighters at
  20,000, 70,000 and each further 70,000 points in this configuration.
- Challenging stages at 3, 7, 11, and so on: 40 scheduled, nonattacking targets,
  a results screen, 100 bonus points per target or 10,000 for all 40.
- Distinct synthesized start, entry, shot, dive, armor, destruction, tractor beam,
  capture, rescue, extra-fighter and challenge sounds. Browser audio is enabled
  only after user interaction. Sound is reconstructed, not an original recording.

## Capture, rescue, docking

1. Keep at least one spare fighter. Stop firing and enter a boss's blue tractor
   beam. The active fighter is captured and carried back above the boss.
2. A spare fighter launches. Wait for the carrier to **dive with the captive**.
3. Shoot the diving boss, not the red captive. The rescued fighter rotates and
   docks alongside the current fighter, giving parallel double shots.
4. A dual fighter has two collision targets. Losing one side leaves a single
   fighter and does not consume an additional spare.

Killing the carrier while it is still in formation does **not** immediately dock
its captive: a hostile fighter escapes and can return with a boss in the next
normal stage. Shooting a captive destroys it. Losing or capturing the last
available fighter ends the game. A dual fighter cannot become a triple fighter.

## Development and tests

Serve this directory with any static HTTP server, for example:

```sh
python3 -m http.server 8000
npm test
```

No install step or build dependencies are required. The `game.js` simulation is
independent of the browser. Its 20 tests cover wave scheduling, scoring, entry
paths, shot limits, lives, captures, actual projectile-based rescue, docking,
rogue fighters, pause, bonus stages and a four-minute automated simulation.
`render.js`, `audio.js`, and `app.js` handle graphics, sound, and browser input.
An explicitly requested `?debug=1` URL exposes `window.__galaga` for local testing;
the ordinary URL does not expose it.

Chromium checks also exercised keyboard input, pause/resume, audio mixer output,
390 × 844 mobile multitouch, resizing and disabled browser storage. Those checks
used an in-memory page assembled from these sources, not an emulated arcade ROM.

## Deployment

Every push to `main` runs the game-rule tests, packages only the six public web
files, and deploys with GitHub Actions to GitHub Pages. Tests, documentation and
repository metadata are not included in the Pages artifact.

## Reference

Bandai Namco's official Galaga history and game-system description:
https://galaga.com/en/history/galaga.php

The implemented rules, asset approximations, optional practice mode and added
browser conveniences are documented above; no claim of exact original timing,
all original stage patterns, sound-chip emulation or ROM compatibility is made.
