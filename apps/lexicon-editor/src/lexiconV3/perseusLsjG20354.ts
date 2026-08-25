import { createHash } from "node:crypto";

export const PINNED_G20354_PERSEUS_ARTIFACT_PATH =
  "src/lexiconV3/sources/perseus-lsj-g20354-n35193.json" as const;
export const PINNED_G20354_PERSEUS_ARTIFACT_DIGEST =
  "8328f385c32cb729063f021dbe42e6824e34c3cd059a6599e884e9d14454f325" as const;
export const PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST =
  "93f2ec89f62affc0367b07ca506c4baa098fcd72eb12081f9232ff4c2f1b90be" as const;
export const PINNED_G20354_PERSEUS_PAYLOAD_DIGEST =
  "2b28f5170734d0e17c881a4144df2c92d9bfb9cbb17f9ac33858196eaf010550" as const;
export const PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST =
  "2e0ef90281c62e320f5386364b875f1000d1bcb22718369a5dbe0b6c68d5ad95" as const;
export const PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST =
  "89c4765f8d7a06a1db40d88ed5c5b1a95b362ed76583986382fda0ab716157b6" as const;
export const PINNED_G20354_PERSEUS_ACCESSED_AT = "2026-07-14" as const;
export const PINNED_G20354_PERSEUS_LICENSE_URL =
  "https://creativecommons.org/licenses/by-sa/4.0/" as const;
export const PINNED_G20354_PERSEUS_ATTRIBUTION =
  "Text provided under a CC BY-SA license by Perseus Digital Library, http://www.perseus.tufts.edu, with funding from The National Endowment for the Humanities." as const;
export const PINNED_G20354_PERSEUS_PROVENANCE_URL =
  "https://github.com/PerseusDL/lexica/blob/b5e707bdda2d6c8e0bb6c29657454996b4fb04d7/CTS_XML_TEI/perseus/pdllex/grc/lsj/README.md" as const;
export const PINNED_G20354_PERSEUS_MODIFICATIONS =
  "The TEI entry was reduced to a canonical semantic payload; the beta-code headword and citations were expanded for readability, and the source wording was otherwise preserved." as const;

export type PinnedG20354PerseusArtifactReasonCode =
  | "g20354-perseus-artifact-digest-mismatch"
  | "g20354-perseus-artifact-license-mismatch"
  | "g20354-perseus-artifact-malformed"
  | "g20354-perseus-artifact-payload-digest-mismatch"
  | "g20354-perseus-artifact-payload-malformed"
  | "g20354-perseus-artifact-source-mismatch"
  | "g20354-perseus-artifact-verified";

export interface PinnedG20354PerseusArtifactVerification {
  valid: boolean;
  reasonCodes: PinnedG20354PerseusArtifactReasonCode[];
  artifactDigest: string;
  payloadDigest: string | null;
}

const EXPECTED_SOURCE = Object.freeze({
  name: "A Greek-English Lexicon (LSJ)",
  provider: "Perseus Digital Library",
  repository: "https://github.com/PerseusDL/lexica",
  commit: "b5e707bdda2d6c8e0bb6c29657454996b4fb04d7",
  path: "CTS_XML_TEI/perseus/pdllex/grc/lsj/grc.lsj.perseus-eng5.xml",
  rawUrl:
    "https://raw.githubusercontent.com/PerseusDL/lexica/b5e707bdda2d6c8e0bb6c29657454996b4fb04d7/CTS_XML_TEI/perseus/pdllex/grc/lsj/grc.lsj.perseus-eng5.xml",
  viewerUrl:
    "https://atlas.perseus.tufts.edu/dictionaries/entry/urn%3Acite2%3Ascaife-viewer%3Adictionaries.v1%3Alsj-n35193/",
  urn: "urn:cite2:scaife-viewer:dictionaries.v1:lsj-n35193",
  accessedAt: PINNED_G20354_PERSEUS_ACCESSED_AT,
  sourceFileSha256: PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
  sourceFragmentSha256: PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST,
  sourceFragmentBytes: 1910
});

const EXPECTED_LICENSE = Object.freeze({
  spdx: "CC-BY-SA-4.0",
  url: PINNED_G20354_PERSEUS_LICENSE_URL,
  attribution: PINNED_G20354_PERSEUS_ATTRIBUTION,
  provenanceUrl: PINNED_G20354_PERSEUS_PROVENANCE_URL,
  modifications: PINNED_G20354_PERSEUS_MODIFICATIONS
});

const EXPECTED_PAYLOAD = Object.freeze({
  definition: "alter; in the passive, sodomite",
  headword: "ἐνδιαλλάσσω",
  shortDef: "alter; passive, to be a sodomite",
  citations: Object.freeze([
    "Aristotle, Physiognomonica 806a13",
    "LXX 3 Kings 22:47",
    "Aquila Genesis 38:21"
  ]),
  sourceForms: Object.freeze({
    headwordBetaCode: "e)ndialla/ssw",
    atticBetaCode: "e)ndia/-ttw",
    passiveBetaCode: "-agme/nos, o("
  }),
  urn: "urn:cite2:scaife-viewer:dictionaries.v1:lsj-n35193"
});

/**
 * Verifies the checked-in LSJ semantic slice without network access. The
 * caller additionally hashes the raw JSON file so a whitespace-only rewrite
 * cannot silently replace the reviewed artifact.
 */
export function verifyPinnedG20354PerseusArtifact(
  value: unknown
): PinnedG20354PerseusArtifactVerification {
  const reasons = new Set<PinnedG20354PerseusArtifactReasonCode>();
  const artifactDigest = sha256(stableJson(value));
  const artifact = asRecord(value);
  if (
    !artifact ||
    !sameKeys(artifact, {
      schemaVersion: true,
      entryKey: true,
      source: true,
      license: true,
      payload: true,
      payloadSha256: true
    }) ||
    artifact.schemaVersion !== "perseus-lsj-entry@1" ||
    artifact.entryKey !== "greek:G20354"
  ) {
    reasons.add("g20354-perseus-artifact-malformed");
  }

  const source = asRecord(artifact?.source);
  if (!source || stableJson(source) !== stableJson(EXPECTED_SOURCE)) {
    reasons.add("g20354-perseus-artifact-source-mismatch");
  }

  const license = asRecord(artifact?.license);
  if (!license || stableJson(license) !== stableJson(EXPECTED_LICENSE)) {
    reasons.add("g20354-perseus-artifact-license-mismatch");
  }

  const payload = asRecord(artifact?.payload);
  if (!payload || stableJson(payload) !== stableJson(EXPECTED_PAYLOAD)) {
    reasons.add("g20354-perseus-artifact-payload-malformed");
  }
  const payloadDigest = payload ? sha256(stableJson(payload)) : null;
  if (
    payloadDigest !== PINNED_G20354_PERSEUS_PAYLOAD_DIGEST ||
    artifact?.payloadSha256 !== PINNED_G20354_PERSEUS_PAYLOAD_DIGEST
  ) {
    reasons.add("g20354-perseus-artifact-payload-digest-mismatch");
  }
  if (artifactDigest !== PINNED_G20354_PERSEUS_ARTIFACT_DIGEST) {
    reasons.add("g20354-perseus-artifact-digest-mismatch");
  }

  const valid = reasons.size === 0;
  if (valid) reasons.add("g20354-perseus-artifact-verified");
  return {
    valid,
    reasonCodes: [...reasons].sort(),
    artifactDigest,
    payloadDigest
  };
}

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite-json-number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value !== "object") throw new Error("unsupported-json-value");
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sameKeys(
  value: Record<string, unknown>,
  expected: Record<string, unknown>
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify(Object.keys(expected).sort())
  );
}
