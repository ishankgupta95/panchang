# Contributing to panchang-ts

## Dev Setup

```bash
git clone https://github.com/your-username/panchang-ts.git
cd panchang-ts
npm install
```

Start TypeScript in watch mode (rebuilds on save):

```bash
npm run dev
```

## Running Tests

```bash
npm test               # watch mode (re-runs on file changes)
npm run test:run       # single pass, exit with code
npm run test:coverage  # coverage report
```

Tests live in `tests/` mirroring `src/`:

```
tests/
├── unit/         # one file per src module
├── integration/  # end-to-end fixtures validated vs DrikPanchang
└── benchmarks/   # performance regression tests
```

When adding a date/city fixture, record expected values from
[DrikPanchang.com](https://www.drikpanchang.com) first, then write the test.

## Running Benchmarks

```bash
npm run bench
```

Performance budgets (must not regress):

| Mode | Node.js | Hermes target |
|------|---------|---------------|
| Names-only (`computeEndTimes: false`) | &lt;1 ms | &lt;100 ms |
| Full with end-times | &lt;5 ms | &lt;500 ms |

## Type-checking & Build

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsup → dist/ (ESM + CJS + .d.ts)
```

Before opening a PR all three must pass:

```bash
npm run typecheck && npm run build && npm run test:run
```

## Branch & PR Conventions

- Branch from `master`.
- Naming: `fix/<description>`, `feat/<description>`.
- One logical change per PR; prefer small, focused PRs.
- Commit messages: imperative mood, &lt;72 characters.
  - `add Yoga end-time binary search`
  - `fix Rahu Kalam slot index off-by-one`
  - `refactor: extract findDailyElements into search.ts`
- Add a changeset before merging: `npx changeset`

## Hermes Compatibility

Run the Hermes smoke test before merging API or dependency changes:

```bash
npm run test:hermes
```

This compiles the ESM bundle to Hermes bytecode and checks for unsupported syntax.
Stick to ES2019 baseline: no heavy `Intl` APIs, no `eval`, no optional chaining
in complex chains that Hermes older versions reject.

## Code Style

- Pure functions where possible; no side effects in `src/core/` or `src/astronomy/`.
- All dates are UTC internally — timezone conversion happens at result-assembly only.
- Hermes-safe JS: ES2020 syntax, avoid `Intl`-heavy features, no dynamic `import()`.

## License

By contributing you agree your work will be licensed under the project's MIT license.
