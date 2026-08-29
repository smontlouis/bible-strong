import assert from "node:assert/strict";
import { test } from "node:test";

import {
  preferredLexiconIdentities,
  type SelectedOccurrence
} from "../web/src/studio/jsonlBibleIdentities.js";

test("keeps distinct lexical occurrences while hiding redundant parents", () => {
  const occurrence: SelectedOccurrence = {
    ref: "Lam.2.7",
    version: "FMAR",
    surface: "livré",
    strong: ["H5462", "H5414"],
    estrong: [],
    dstrong: ["H5414M"],
    ustrong: ["H5414G"]
  };

  assert.deepEqual(preferredLexiconIdentities(occurrence), [
    { code: "H5414M", kind: "dStrong" },
    { code: "H5462", kind: "Strong" }
  ]);
});

test("uses dStrong instead of its eStrong and classical Strong parents", () => {
  const occurrence: SelectedOccurrence = {
    ref: "Lam.2.7",
    version: "FMAR",
    surface: "rejeté",
    strong: ["H2186", "H5010"],
    estrong: ["H2186a"],
    dstrong: ["H2186A"],
    ustrong: ["H2186A"]
  };

  assert.deepEqual(preferredLexiconIdentities(occurrence), [
    { code: "H2186A", kind: "dStrong" },
    { code: "H5010", kind: "Strong" }
  ]);
});

test("shows only the most precise identity for a single occurrence", () => {
  const occurrence: SelectedOccurrence = {
    ref: "Lam.2.4",
    version: "LSG",
    surface: "assaillant",
    strong: ["H6862"],
    estrong: ["H6862c"],
    dstrong: ["H6862C"],
    ustrong: []
  };

  assert.deepEqual(preferredLexiconIdentities(occurrence), [
    { code: "H6862C", kind: "dStrong" }
  ]);
});

test("falls back from eStrong to classical Strong by lexical base", () => {
  const occurrence: SelectedOccurrence = {
    ref: "Gen.1.1",
    version: "LSG",
    surface: "mot",
    strong: ["H1234", "H5678"],
    estrong: ["H1234a"],
    dstrong: [],
    ustrong: ["H9999"]
  };

  assert.deepEqual(preferredLexiconIdentities(occurrence), [
    { code: "H1234a", kind: "eStrong" },
    { code: "H5678", kind: "Strong" }
  ]);
});

test("retains distinct dStrong occurrences that share a classical base", () => {
  const occurrence: SelectedOccurrence = {
    ref: "Gen.1.1",
    version: "LSG",
    surface: "mot",
    strong: ["H1234"],
    estrong: ["H1234a"],
    dstrong: ["H1234A", "H1234B"],
    ustrong: []
  };

  assert.deepEqual(preferredLexiconIdentities(occurrence), [
    { code: "H1234A", kind: "dStrong" },
    { code: "H1234B", kind: "dStrong" }
  ]);
});
