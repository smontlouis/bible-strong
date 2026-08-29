export const STRONG_IDENTITY_KINDS = [
  "strong",
  "estrong",
  "dstrong",
  "ustrong"
] as const;

export type StrongIdentityKind = (typeof STRONG_IDENTITY_KINDS)[number];
