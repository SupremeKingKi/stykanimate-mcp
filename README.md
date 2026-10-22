# StykAnimate MCP server

An [MCP](https://modelcontextprotocol.io) server for [StykAnimate](https://stykanimate.com), the
open-source stick figure animation app. It lets an AI assistant open a StykAnimate or Pivot
project, read its rig and timeline, and change the animation — without a screen, a GPU or a
browser.

The server reuses the app's own document model, rig evaluator and file codec, so a project it
opens is the same project the desktop app opens, and a project it writes is the same project the
app writes.

## What it can do

**Read a project.** Open a `.styk`, `.stkz`, `.stykmov`, `.piv` or `.stk` file and report its
canvas, frame rate, keyframes, layers, figure definitions and instances.

**Read the rig.** Evaluate the animation at any tick and get back where every joint sits in
canvas pixels, where each segment starts and ends, and what the inverse kinematics controllers
are doing. This is the part that makes the server useful: a model can answer "where is the
character's left hand at frame 30?" and act on the answer.

**Change the animation.** Move, rotate, scale, flip, align and re-order figures. Set a joint's
angle, length or world position. Move an inverse kinematics target. Add, delete, duplicate and
retime keyframes. Recolour figures, parts, layers and the scene. Every change is one undoable
step, and `history_undo` / `history_redo` walk back through them.

**Write a project.** Save as a StykAnimate project, a portable figure or a movieclip, or export
to a Pivot `.piv` or `.stk` file.

## Install

```sh
npm install -g stykanimate-mcp
```

Or run it without installing:

```sh
npx stykanimate-mcp
```

### Connect a client

Claude Code:

```sh
claude mcp add stykanimate -- npx -y stykanimate-mcp
```

Claude Desktop, Cursor, or any client that reads `mcpServers`:

```json
{
  "mcpServers": {
    "stykanimate": {
      "command": "npx",
      "args": ["-y", "stykanimate-mcp"]
    }
  }
}
```

VS Code (`.vscode/mcp.json`):

```json
{
  "servers": {
    "stykanimate": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "stykanimate-mcp"]
    }
  }
}
```

### Run it as a service

```sh
stykanimate-mcp --transport http --port 7331
```

The HTTP transport speaks Streamable HTTP. It only accepts requests from `localhost`, `127.0.0.1`
and `[::1]`, and it rejects a request that carries a foreign `Origin` header, so a page in a
browser cannot drive a server that reads files from the machine. Put your own authentication in
front of it before exposing it beyond the machine.

## Requirements

- Node.js 20 or newer.
- Python 3.10 or newer, **only** to read and write Pivot `.piv` and `.stk` files. The server
  starts the bundled codec on demand and stops it again when it has been idle, so a session that
  only touches StykAnimate files never starts a Python process. Set `STYK_PYTHON` to choose a
  specific interpreter.

## The tools

| Tool | What it does |
| --- | --- |
| `capabilities` | What this server supports, and which projects are open. |
| `project_open` | Open a project file. |
| `project_close` | Close a project. |
| `project_describe` | The structure of the open project. |
| `project_validate` | Run the editor's own document validation. |
| `project_save` | Write the project to a file. |
| `project_timeline` | The keyframes and the playback timeline. |
| `project_seek` | Move the playhead. |
| `figure_list` | The figure instances in the project. |
| `figure_describe` | One figure's definition, rig and instance. |
| `figure_add` | Add a figure instance. |
| `figure_duplicate` | Copy a figure, with its pose. |
| `figure_delete` | Remove a figure from keyframes. |
| `figure_transform` | Move, rotate, scale, flip, align, centre or re-order figures. |
| `pose_evaluate` | The solved rig at a tick. |
| `pose_set` | Set a figure's root, scale and joint angles, lengths and positions. |
| `pose_ik_set` | Move an inverse kinematics target. |
| `pose_set_ik` | Turn a joint's inverse kinematics controller on or off, or change it. |
| `pose_reset` | Return a figure to its rest pose. |
| `keyframe_edit` | Add, delete, duplicate or move keyframes. |
| `keyframe_timing` | Change a keyframe's length, the frame rate or the canvas size. |
| `layer_list` | The layers of the project. |
| `layer_edit` | Create, rename, delete, reorder, fill, show, hide, lock and unlock layers. |
| `style_set` | Recolour a figure, a part, a layer or the scene. |
| `history_undo` | Undo the last change. |
| `history_redo` | Redo the last undone change. |

### How a model should use it

A typical conversation goes: `capabilities` → `project_open` → `project_describe` →
`figure_describe` → `pose_evaluate` → a change → `pose_evaluate` again to check the result.

Two conventions matter:

- **A keyframe number is a position in the project's stored keyframe list.** It is what
  `figure_list`, `pose_*` and `keyframe_*` all use. A project with an advanced timeline can also
  expose a shorter playback timeline; `project_timeline` reports both, and each keyframe says
  whether the playback reaches it.
- **A figure is named by its instance id**, and a joint by its handle id. Both come from
  `figure_list` and `figure_describe`.

## Resources

| Resource | What it holds |
| --- | --- |
| `stykanimate://projects` | A summary of every open project. |
| `stykanimate://projects/{project}/document` | The whole editable document. |
| `stykanimate://projects/{project}/pose` | The solved rig at a tick. |

## How it is built

```
src/            The server: tools, session, file I/O and the codec client
src/tools/      One module per group of tools
vendor/         The StykAnimate editor core, vendored from the app
py/             The Python codec, vendored from the app
scripts/        The vendor sync and the package checks
test/           The tests
```

`vendor/stykanimate` holds the transitive import closure of the app's `editor.mjs`,
`native-container.mjs` and friends: about 300 modules with no third-party runtime dependencies.
`scripts/vendor-sync.mjs` refreshes it from a checkout of the app and records what it copied in
`vendor/stykanimate/PROVENANCE.json`. `npm run vendor:check` fails when the vendored copy has
drifted from its source.

The sync looks for the app in a sibling `StykAnimate-App` directory by default. Point it
elsewhere with `--source <path>` or the `STYKANIMATE_SOURCE` environment variable:

```sh
npm run vendor -- --source ../StykAnimate-App
```

## Development

```sh
npm ci
npm run check     # syntax, tool registration, vendored-core freshness
npm test          # the test suite
```

The tests need a Python interpreter for the codec test; that one test skips itself when there is
none.

## Licence

GPL-3.0-or-later, the same licence as the StykAnimate app this server is built from. See
[LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
