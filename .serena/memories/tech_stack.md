# Tech Stack

- TypeScript 5.6, compiled/run via `ts-node` (CommonJS module target, ES2022) — no build step for dev.
- Runtime: Node 20+ (required for `node --test` glob support in `npm test`).
- Test runner: `node:test` (built-in), no external test framework, no assertion library beyond `node:assert`.
- No runtime dependencies — devDependencies only (`ts-node`, `typescript`, `@types/node`).
- `tsconfig.json`: `strict: true`, `esModuleInterop`, `outDir: dist` (dist is unused in dev flow, only relevant if someone adds a build step).
