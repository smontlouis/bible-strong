import type { ClauseLexicalLevel } from "../../src/strongClauseLexicon.js";
import {
  CONSENSUS_CLAUSE_POLICY,
  type ClausePolicy
} from "../../src/strongClauseAlignment.js";
export const VARIANTS: Record<
  string,
  { level: ClauseLexicalLevel; policy: ClausePolicy }
> = {
  "literal-2": {
    level: "literal",
    policy: { minimumFamilies: 2, maximumSlotWords: 4, sharedCarriers: false }
  },
  "morph-2": {
    level: "inflection",
    policy: { minimumFamilies: 2, maximumSlotWords: 4, sharedCarriers: false }
  },
  "reviewed-2": {
    level: "reviewed",
    policy: { minimumFamilies: 2, maximumSlotWords: 4, sharedCarriers: false }
  },
  "reciprocal-2": {
    level: "reciprocal",
    policy: { minimumFamilies: 2, maximumSlotWords: 4, sharedCarriers: false }
  },
  "meaning-2": {
    level: "meaning",
    policy: { minimumFamilies: 2, maximumSlotWords: 4, sharedCarriers: false }
  },
  "meaning-1": {
    level: "meaning",
    policy: { minimumFamilies: 1, maximumSlotWords: 4, sharedCarriers: false }
  },
  "joint-2": {
    level: "meaning",
    policy: { minimumFamilies: 2, maximumSlotWords: 4, sharedCarriers: true }
  },
  "joint-1": {
    level: "meaning",
    policy: { minimumFamilies: 1, maximumSlotWords: 4, sharedCarriers: true }
  },
  "common-heads": {
    level: "meaning",
    policy: CONSENSUS_CLAUSE_POLICY
  },
  "joint-heads": {
    level: "meaning",
    policy: {
      minimumFamilies: 2,
      maximumSlotWords: 4,
      sharedCarriers: true,
      display: "lexical-head"
    }
  }
};
