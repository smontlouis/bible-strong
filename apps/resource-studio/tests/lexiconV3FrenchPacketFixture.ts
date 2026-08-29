import {
  buildFrenchPacketEnglishReleaseLineage,
  type FrenchPacketEnglishReleaseLineage
} from "../src/lexiconV3/frenchPackets.js";

export const FRENCH_PACKET_FIXTURE_RELEASE_KEY = "lexicon-v3-en-fixture.1";
export const FRENCH_PACKET_FIXTURE_RELEASE_SNAPSHOT = "d".repeat(64);

export function frenchPacketFixtureEnglishRelease(input: {
  entryKey: string;
  gloss: string;
  meaning: string;
  meaningHtml: string;
  releaseKey?: string;
  releaseSnapshotFingerprint?: string;
  glossFieldVersionId?: number;
  meaningFieldVersionId?: number;
  state?: "auto_validated" | "human_validated";
}): FrenchPacketEnglishReleaseLineage {
  const state = input.state ?? "auto_validated";
  return buildFrenchPacketEnglishReleaseLineage({
    entryKey: input.entryKey,
    releaseKey: input.releaseKey ?? FRENCH_PACKET_FIXTURE_RELEASE_KEY,
    releaseSnapshotFingerprint:
      input.releaseSnapshotFingerprint ??
      FRENCH_PACKET_FIXTURE_RELEASE_SNAPSHOT,
    gloss: {
      fieldVersionId: input.glossFieldVersionId ?? 1,
      state,
      method: "source",
      generator: "test-fixture",
      valueText: input.gloss
    },
    meaning: {
      fieldVersionId: input.meaningFieldVersionId ?? 2,
      state,
      method: "source",
      generator: "test-fixture",
      valueText: input.meaning,
      valueHtml: input.meaningHtml
    }
  });
}
