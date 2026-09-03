export type LoopCommandResult = 'ok' | 'already-paused' | 'already-running';

export class TickLoop {
  private handle: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private readonly tick: () => void, private readonly intervalMs: number) {}

  start(): void {
    if (this.stopped || this.handle !== null) return;
    this.handle = setInterval(this.tick, this.intervalMs);
  }

  pause(): LoopCommandResult {
    if (this.handle === null) return 'already-paused';
    clearInterval(this.handle);
    this.handle = null;
    return 'ok';
  }

  resume(): LoopCommandResult {
    if (this.stopped) return 'already-paused';
    if (this.handle !== null) return 'already-running';
    this.handle = setInterval(this.tick, this.intervalMs);
    return 'ok';
  }

  end(): void {
    if (this.handle !== null) clearInterval(this.handle);
    this.handle = null;
    this.stopped = true;
  }

  isRunning(): boolean {
    return this.handle !== null;
  }
}
