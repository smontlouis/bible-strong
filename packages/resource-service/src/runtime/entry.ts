// The module Cloudflare loads. workerd reads every named export as an entrypoint and refuses
// to start on one that is not a function: export only the Worker and its entrypoint classes.
// The public API is `worker.ts`; `LibrarySearch` serves the study assistant (ADR-0103).
export { default } from './worker'
export { LibrarySearch } from './librarySearchEntrypoint'
