import { readFile } from "node:fs/promises";

import {
  extractPrimaryDStrong,
  normalizeStepStrongCode
} from "./lexiconV3/identity.js";

export interface StepLexicalIdentity {
  dStrong: string;
  eStrong: string;
  uStrong: string[];
}

export type StepLexicalIdentityIndex = Map<string, StepLexicalIdentity>;

export async function readStepLexicalIdentityIndex(
  filePaths: string[]
): Promise<StepLexicalIdentityIndex> {
  const index: StepLexicalIdentityIndex = new Map();
  for (const filePath of filePaths) {
    const content = await readFile(filePath, "utf8");
    for (const line of content.split(/\r?\n/u)) {
      const parts = line.replace(/^\uFEFF/u, "").split("\t");
      const eStrong = normalizeExactStepCode(parts[0] ?? "");
      const dStrong = extractPrimaryDStrong(parts[1] ?? "");
      if (!eStrong || !dStrong) continue;
      const identity: StepLexicalIdentity = {
        dStrong,
        eStrong,
        uStrong: extractStepCodes(parts[2] ?? "")
      };
      const existing = index.get(dStrong);
      if (existing && JSON.stringify(existing) !== JSON.stringify(identity)) {
        throw new Error(`Conflicting STEP lexical identity for ${dStrong}`);
      }
      index.set(dStrong, identity);
    }
  }
  return index;
}

function normalizeExactStepCode(value: string): string | undefined {
  if (!/^[HG]\d{4,5}[A-Za-z]?$/u.test(value.trim())) return undefined;
  return normalizeStepStrongCode(value) ?? undefined;
}

function extractStepCodes(value: string): string[] {
  const result: string[] = [];
  for (const match of value.matchAll(/[HG]\d{4,5}[A-Za-z]?(?:_[A-Za-z])?/gu)) {
    const normalized = normalizeStepStrongCode(match[0]);
    if (normalized && !result.includes(normalized)) result.push(normalized);
  }
  return result;
}
