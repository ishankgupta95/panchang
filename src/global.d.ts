/**
 * Global constants injected by bundlers / React Native.
 *
 * In React Native (Metro + Hermes): __DEV__ is set by the runtime.
 * In Node/vitest: __DEV__ is undefined — all dev branches are dead-code eliminated.
 * In tsup production builds: define({ __DEV__: 'false' }) can be added to tsup.config.ts.
 */
declare const __DEV__: boolean | undefined;
