import * as readline from 'node:readline';
import { createGameState } from './state';
import { runTick } from './combat';
import { TickLoop } from './loop';
import { handleCommand } from './commands';
import { render } from './render';
import { TICK_MS } from './economy';

const state = createGameState();
let lastEvents: string[] = [
  'You are the dungeon core.',
  'Type tutorial for guidance or help for commands.',
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function draw(): void {
  console.clear();
  console.log(render(state, lastEvents));
}

// console.clear() wipes whatever readline had drawn for the in-progress input
// line without telling readline, so the prompt/typed-so-far text must be
// explicitly redrawn after every clear — otherwise typing is invisible and
// gets erased by the next tick before it's readable.
function redraw(): void {
  draw();
  rl.prompt(true);
}

const loop = new TickLoop(() => {
  lastEvents = runTick(state);
  // The simulation always advances, but the visible redraw is skipped while
  // the player has an unsent, in-progress line: once that line wraps to a
  // second terminal row, readline redraws it with row-relative cursor moves
  // based on its own last-known row count, which our full-screen clear
  // invalidates — corrupting the display. Deferring until the line is empty
  // (submitted, or never started) avoids the conflict entirely.
  if (rl.line.length === 0) {
    redraw();
  }
  if (state.runState === 'over') {
    loop.end();
  }
}, TICK_MS);

redraw();
loop.start();

rl.on('line', (line) => {
  const { lines, quit } = handleCommand({ state, loop }, line);
  lastEvents = [];
  draw();
  for (const l of lines) console.log(l);
  if (quit) {
    rl.close();
    process.exit(0);
    return;
  }
  rl.prompt(true);
});
