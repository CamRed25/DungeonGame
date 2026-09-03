import * as readline from 'node:readline';
import { createGameState } from './state';
import { runTick } from './combat';
import { TickLoop } from './loop';
import { handleCommand } from './commands';
import { render } from './render';
import { TICK_MS } from './economy';

const state = createGameState();
let lastEvents: string[] = [];

function draw(): void {
  console.clear();
  console.log(render(state, lastEvents));
}

const loop = new TickLoop(() => {
  lastEvents = runTick(state);
  draw();
  if (state.runState === 'over') {
    loop.end();
  }
}, TICK_MS);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

draw();
loop.start();

rl.on('line', (line) => {
  const { lines, quit } = handleCommand({ state, loop }, line);
  lastEvents = [];
  draw();
  for (const l of lines) console.log(l);
  if (quit) {
    rl.close();
    process.exit(0);
  }
});
