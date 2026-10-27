# fight

A small tool for stick-figure fight animations, written in code and rendered to MP4.

`scenes/hall-duel.mjs` is a 35-second fight in a stone hall, where Kade (fists, then a katana) and Sora (a scythe) take on Vorthak, a horned brute. It was made in the style of Stick Nodes combo animations.

```bash
npm run fight
```

This writes `fight/out/kade-sora-vs-vorthak.mp4` (1280×720, 30 fps, with sound). It needs `ffmpeg` on the PATH, or set `FFMPEG` to its path, plus the optional `@napi-rs/canvas` package this repo already uses for rendering.

`scenes/duel.mjs` is a 22-second one-on-one, Kade against Vorthak. It travels from the hall, through a pillar and the ruined end of the hall, out onto an open terrace. `npm run duel` writes `fight/out/kade-vs-vorthak.mp4`.

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

## Readability

Each character has a signature colour (Kade blue, Sora violet, Vorthak red). It colours their smears, which are flat in-between poses drawn when a limb or body moves far in one frame, their weapon trails, and the sparks of their hits. Light hits get a small star and specks; only heavy hits get the big burst. Camera keys with `fit: [min, max]` frame the figures they follow as tightly as the range allows, and pull back when someone is high in the air. The score's drum grid re-phases onto the hit sounds, so blows land on the beat.

## Motion

Keys say where a pose is; `Track.at` loosens the motion between them so it reads hand-animated, not puppeted:

- **Overlap:** each joint samples the keys a little behind the hips (arms, then forearms, head and weapon). Going into a snapped strike the lag fades out, so the striking limb lands on its key, then it fades back in after contact.
- **Overshoot and settle:** a joint that snaps to a key swings past it and springs back over about a third of a second.
- **Never still:** every figure drifts and breathes slightly, so a held pose is never a frozen frame. The legs are left out, so feet do not wander.
- **Root arcs:** a step or lunge along the ground lifts the hips in a small arc.

**Contact:** at the end of `build()`, `connect()` in `contacts.mjs` measures the gap between each striking fist, foot or blade and the body it hits, and lunges the striker in (or back, for a long weapon that overreaches) so the blow lands on the body. Mark an impact `contact: false` when no body is meant to be touched (a projectile, a blade into the floor, a dash that cuts through). Run `node fight/check-contacts.mjs fight/scenes/hall-duel.mjs --all` to see every gap.

**Feet:** `feet.mjs` pins a foot where it touches the floor and re-bends the leg each frame (a two-bone hip and knee solve) so the body moves over it instead of the foot skating. When the animation pulls the foot more than 40px away, or the leg is overstretched, the foot takes a quick step and plants again. After a render the tool prints how far planted feet slid and how many steps each figure took; `--no-feet` turns locking off to compare.

The renderer adds **recoil**: every impact jolts whoever takes it (trunk, then head, arms, and a short shove), even through a hit-stop.

## Stage layout

A scene can lay out the stage with `stage: { layout: { ruin: [from, to] }, pillars: [x, ...] }`. Between `from` and `to` (world x along the fight) the back wall crumbles away to a light sky with distant mountains, the background pillars stand as stumps among rubble, and past `to` the floor carries on as an open terrace. `pillars` stand in the fighters' own plane. A `breakPillar` event (with an `x`) shatters the nearest one, leaving a stump while its top topples onto the floor. A scene without a layout gets the plain hall.

## Syncing to the music

A scene can call `syncToBeat(scene)` from `beats.mjs` at the end of `build()`, after `connect()`, as the duel does. The score then keeps a steady tempo, and the fight's clock bends smoothly between blows so heavy blows land on eighth notes and light ones on sixteenths. Every key, effect, lunge, camera key and music section moves with it. It replays the renderer's frame clock, counting hit-stops and slow motion, so the blows land on the beat in the finished video, not just in scene time. At 150 bpm a sixteenth is exactly three frames at 30 fps. After rendering, the tool prints how far each blow's sound is from the beat. A scene that does not sync keeps the old behaviour, where the drums re-phase to follow the hits.

## Sound effects

Hits, blocks, clangs, slashes, landings and booms are built in `sfx.mjs` from recorded samples in `assets/sfx`: three Kenney.nl packs (Impact Sounds, RPG Audio, Sci-fi Sounds), all CC0, so no credit is required. Each named sound layers one or more recordings, sometimes over the synthesised sound for weight, and each time it plays it picks a random variant at a slightly random pitch. Without the samples, the synthesised sounds play on their own.

## Using a song

The duel plays "Metalmania" by Kevin MacLeod (incompetech.com, CC BY 4.0), kept in `assets/music` with its credit in [CREDITS.md](assets/music/CREDITS.md). A video that uses it must carry that credit; the duel shows it on the end card.

To use a song, name it in the scene's `music.track` (`file`, the `start` second, `gain`, and `duck` windows where it dips) and set `music.bpm` and `music.offset` to its beat. The song then replaces the synthesised score, and the hits play on top. To find those numbers:

```bash
node fight/music.mjs fight/assets/music/Metalmania.mp3 --seconds 14
```

It measures the tempo, where the beats and bar starts fall, and how loud each bar is, then suggests the strongest stretch that starts on a bar. Start the song on a bar start and the beat grid begins at the first frame (`offset: 0`).

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
