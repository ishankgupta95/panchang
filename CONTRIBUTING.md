# Contributing to panchang-ts

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/your-username/panchang-ts
cd panchang-ts
npm install
npm test          # Run tests in watch mode
npm run build     # Build ESM + CJS
npm run typecheck # TypeScript validation
```

## Testing

We validate against DrikPanchang.com reference data. See `scripts/collect-fixtures.md`
for how to add new test fixtures.

```bash
npm run test:run       # Single run
npm run test:coverage  # With coverage report
```

## Submitting Changes

1. Fork the repo
2. Create a feature branch
3. Add a changeset: `npx changeset`
4. Open a PR against `main`

## Code Style

- Pure functions where possible
- No side effects in `src/core/` or `src/astronomy/`
- All dates are UTC internally — timezone conversion at boundaries only
- Hermes-safe JS only (ES2020, no Intl dependency, no eval)
