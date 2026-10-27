# fight

A small tool for stick-figure fight animations, written in code and rendered to MP4.

`scenes/hall-duel.mjs` is a 40-second fight in a stone hall, where Kade (fists, then a katana) and Sora (a scythe) take on Vorthak, a horned brute. It was made in the style of Stick Nodes combo animations.

```bash
npm run fight
```

This writes `fight/out/kade-sora-vs-vorthak.mp4` (1280×720, 30 fps, with sound). It needs `ffmpeg` on the PATH, or set `FFMPEG` to its path, plus the optional `@napi-rs/canvas` package this repo already uses for rendering.

## Pieces

| File | What it does |
| --- | --- |
| `rig.mjs` | The skeleton: a pose of joint angles solved into points |
| `poses.mjs` | Named key poses (stances, punches, kicks, sword and scythe moves, hits, falls) |
| `characters.mjs` | The cast and how each is drawn, with scarves and tails as simulated ropes |
| `timeline.mjs` | Keyframe tracks with easing, and moves (`run`, `strike`, `react`, `launch`, `jump`, `dash`) |
| `effects.mjs` | Impacts, sparks, dust, debris, rings, slash lines, energy waves, flashes, speed lines, speech |
| `stage.mjs` | The parallax hall: windows and light shafts, pillars, floor, balustrade |
| `audio.mjs` | Synthesised sound effects and a drone, drum and bass score; nothing is sampled |
| `render.mjs` | Runs a scene frame by frame (camera, hit-stop, slow motion, afterimages, weapon trails, impact frames, tilt, colour split) and encodes it |
| `bake-clips.mjs` | Renders StykAnimate library movieclips into sprite strips, using the StykAnimate engine |

## Library clips

Some effects are StykAnimate community library movieclips, kept in `assets/library` with credits in [CREDITS.md](assets/library/CREDITS.md). Bake them into sprites once, and again after adding a clip:

```bash
node fight/bake-clips.mjs
```

A scene plays one with a `sprite` event, for example `{ type: 'sprite', t, at: 'vorthak.hip', ground: true, name: 'ground-dust-by-vamz', scale: 0.5 }`.

## Events for big moments

Besides impacts, dust and sparks, a scene can fire `slowmo` (`dur` and `scale` in scene seconds), `hitstop`, `punch` (a zoom kick), `tilt`, `split` (an RGB split), `impactFrames` (stark inverted frames), `crack` (floor cracks or a crater that stay) and the `braam`, `riser` and `boom` sounds.

## Working on a scene

A scene exports `build()`, which returns tracks, events and camera keys. To check a stretch of it without rendering the whole video, render a contact sheet of chosen moments, in scene seconds:

```bash
node fight/render.mjs fight/scenes/hall-duel.mjs --sheet 6.6-7.8:0.1 --out fight/out/sheet.png
```

To see every pose in the library drawn on one character:

```bash
node fight/gallery.mjs fight/out/gallery.png vorthak
```
