import type { JsonlBibleId } from "./types";

export interface SelectedOccurrence {
  ref: string;
  version: JsonlBibleId;
  surface: string;
  strong: string[];
  estrong: string[];
  dstrong: string[];
  ustrong: string[];
}

export type LexiconIdentityKind = "dStrong" | "eStrong" | "Strong";

export interface LexiconIdentity {
  code: string;
  kind: LexiconIdentityKind;
}

export function preferredLexiconIdentities(
  occurrence: SelectedOccurrence | null
): LexiconIdentity[] {
  if (!occurrence) return [];

  const identities = new Map<string, LexiconIdentity>();
  const representedBases = new Set<string>();
  const primaryGroups = [
    { kind: "dStrong", values: occurrence.dstrong },
    { kind: "eStrong", values: occurrence.estrong },
    { kind: "Strong", values: occurrence.strong }
  ] satisfies Array<{ kind: LexiconIdentityKind; values: string[] }>;

  for (const { kind, values } of primaryGroups) {
    const groupBases = new Set<string>();
    for (const value of values) {
      const normalized = normalizeLexiconStrong(value);
      if (!normalized) continue;

      const base = classicalStrongBase(normalized);
      if (representedBases.has(base)) continue;

      identities.set(normalized, { code: normalized, kind });
      groupBases.add(base);
    }
    for (const base of groupBases) {
      representedBases.add(base);
    }
  }

  return [...identities.values()];
}

function normalizeLexiconStrong(value: string) {
  const compact = value.trim();
  const match = compact.match(/^([GHgh])0*(\d+)([A-Za-z]?)$/u);
  if (!match) return compact;
  return `${match[1].toUpperCase()}${match[2].padStart(4, "0")}${match[3] ?? ""}`;
}

function classicalStrongBase(value: string) {
  const match = /^([GH])(\d+)/u.exec(value);
  return match ? `${match[1]}${match[2]}` : value;
}
