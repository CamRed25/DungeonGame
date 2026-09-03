import * as readline from 'node:readline';
import { createGameState } from './state';
import { runTick } from './combat';
import { TickLoop } from './loop';
import { handleCommand } from './commands';
import { render } from './render';
import { TICK_MS } from './economy';

const state = createGameState();
let lastEvents: string[] = [];

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
  redraw();
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
