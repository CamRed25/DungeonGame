# Suggested Commands

```bash
npm install                 # install deps (Node 20+ required)
npm test                    # full suite via node:test, globs tests/**/*.test.ts
npm run dev                  # play interactively (ts-node runs src/main.ts directly)
npx tsc --noEmit              # type-check only, no emit
```

Single test file:
`node -r ts-node/register --test tests/combat.test.ts`

Filter by test name substring:
`node -r ts-node/register --test --test-name-pattern="<substring>" tests/combat.test.ts`

No linter/formatter configured in this repo (no eslint/prettier config present as of onboarding).
