# Dungeon Core

Dungeon Core is a terminal-based dungeon management game written in
TypeScript. You are the dungeon itself: dig a route, place monsters and traps,
and stop adventurers from reaching your core.

There is no win state yet. The run ends when an adventurer reaches the core.

## Requirements

- Node.js 20 or newer
- npm

## Run the game

```bash
npm install
npm run dev
```

The game starts paused only long enough to display the initial screen, then
begins ticking once per second. Type `pause` whenever you need time to plan.

## Commands

Coordinates use `(x, y)`, with `(0, 0)` at the top-left. `x` increases to the
right and `y` increases downward.

```text
dig x y                         Dig one adjacent wall cell
dig line x1 y1 x2 y2            Dig a horizontal or vertical line
spawn goblin x y                Place a goblin
trap spike x y                  Place a spike trap
pause                           Pause simulation ticks
resume                          Resume simulation ticks
status                          Show detailed game state
tutorial                        Show the in-game tutorial
help                            Show the command list
quit                            Exit the game
```

## How to play

You begin with 50 mana. The core is at `(2, 6)` and the entrance is at
`(17, 6)`. The entrance starts disconnected, so first dig a continuous route
between them. For example:

```text
dig line 16 6 3 6
spawn goblin 10 6
trap spike 7 6
resume
```

Digging costs 2 mana per cell. Goblins cost 15 mana and have 10 HP and 3
attack. Spike traps cost 8 mana and deal 6 damage once. Adventurers spawn every
10 ticks once a terrain-only path exists from the entrance to the core.

Defeating an adventurer awards 12 mana. The core also gains a small passive
amount of mana while the game is running.

## Terminal display

The map uses these symbols:

| Symbol | Meaning |
| --- | --- |
| `#` | Wall |
| `.` | Floor |
| `C` | Core |
| `A` | Adventurer |
| `m` | Monster |
| `t` | Trap |
| `X` | Core after the run ends |

Adventurers follow the shortest available terrain path. Monsters can fight
adventurers occupying the same or an adjacent cell, while a living monster in
the next path cell blocks movement. Traps trigger when an adventurer moves
onto them and are then consumed.

## Development

Run the test suite and type checker with:

```bash
npm test
npx tsc --noEmit
```

The simulation is kept in pure synchronous modules under `src/`; terminal
input, rendering, and timers are handled at the I/O boundary.

## TheBrain project memory

This repository is connected to its persistent project memory in
`/home/cam/Documents/repos/TheBrain/projects/dungeongame/` through
`.brain/project.yaml`.

To use it as an extra brain, set the vault path once in your shell:

```bash
export THEBRAIN_HOME=/home/cam/Documents/repos/TheBrain
```

From this repository, useful commands include:

```bash
brain status       # Show the current DungeonGame baton
brain context      # Print the active working set
brain graph        # Inspect project-node connectivity
brain doctor       # Validate the project memory
```

The project memory starts at
`TheBrain/projects/dungeongame/INDEX.md`, followed by `baton.md` and its
linked nodes.
