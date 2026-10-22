/**
 * A text matched literally inside a LIKE or ILIKE pattern: its `%` and `_` stop being
 * wildcards, so a search for `50%` looks for that text rather than for anything after `50`.
 * PostgreSQL escapes with a backslash by default.
 */
export const likeLiteral = (text: string): string =>
  text.replace(/[\\%_]/gu, character => `\\${character}`)
