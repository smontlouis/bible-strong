export type TranslationFamily =
  | "formal"
  | "formal-readable"
  | "dynamic"
  | "paraphrase"
  | "unknown";

export type StrongDensityPolicy = "high" | "medium" | "semantic";

export type LearnedFunctionWordMode = "restricted" | "reference-only";

export interface ReaderAlignmentPolicy {
  maxStrongPerWord: number;
  minEmptySourceAgreement: number;
  learnedTranslationMinScore: number;
  learnedFunctionWordMode: LearnedFunctionWordMode;
}

export interface TranslationProfile {
  bible: string;
  family: TranslationFamily;
  label: string;
  style: "hybrid-calibrated";
  strongDensityPolicy: StrongDensityPolicy;
  expectedTokenCoverage: {
    low: number;
    high: number;
  };
  readerAlignment: ReaderAlignmentPolicy;
  hardVerseThresholds: {
    lowTokenCoverage: number;
    referenceDensityRatio: number;
    lowOriginalConfirmation: number;
    manyOriginalStrongUnplaced: number;
  };
  notes: string;
}

const DEFAULT_PROFILE: TranslationProfile = {
  bible: "default",
  family: "unknown",
  label: "Unknown translation profile",
  style: "hybrid-calibrated",
  strongDensityPolicy: "medium",
  expectedTokenCoverage: { low: 0.4, high: 0.54 },
  readerAlignment: {
    maxStrongPerWord: 3,
    minEmptySourceAgreement: 2,
    learnedTranslationMinScore: 0.36,
    learnedFunctionWordMode: "restricted"
  },
  hardVerseThresholds: {
    lowTokenCoverage: 0.28,
    referenceDensityRatio: 0.72,
    lowOriginalConfirmation: 0.72,
    manyOriginalStrongUnplaced: 5
  },
  notes:
    "Default profile. Interpret coverage conservatively until the translation style is classified."
};

const PROFILES = new Map<string, TranslationProfile>([
  [
    "bfc",
    {
      bible: "bfc",
      family: "dynamic",
      label: "Bible en francais courant",
      style: "hybrid-calibrated",
      strongDensityPolicy: "semantic",
      expectedTokenCoverage: { low: 0.38, high: 0.5 },
      readerAlignment: {
        maxStrongPerWord: 2,
        minEmptySourceAgreement: 3,
        learnedTranslationMinScore: 0.43,
        learnedFunctionWordMode: "reference-only"
      },
      hardVerseThresholds: {
        lowTokenCoverage: 0.24,
        referenceDensityRatio: 0.62,
        lowOriginalConfirmation: 0.72,
        manyOriginalStrongUnplaced: 8
      },
      notes:
        "Dynamic common-language translation. Prefer semantic reader tags and preserve unrendered original inventory as empty Strong when needed."
    }
  ],
  [
    "bds",
    {
      bible: "bds",
      family: "dynamic",
      label: "Bible du Semeur",
      style: "hybrid-calibrated",
      strongDensityPolicy: "semantic",
      expectedTokenCoverage: { low: 0.38, high: 0.48 },
      readerAlignment: {
        maxStrongPerWord: 2,
        minEmptySourceAgreement: 3,
        learnedTranslationMinScore: 0.44,
        learnedFunctionWordMode: "reference-only"
      },
      hardVerseThresholds: {
        lowTokenCoverage: 0.24,
        referenceDensityRatio: 0.62,
        lowOriginalConfirmation: 0.72,
        manyOriginalStrongUnplaced: 8
      },
      notes:
        "Dynamic-equivalence translation. Lower Strong density is expected because the wording often renders ideas rather than preserving source-word structure."
    }
  ],
  [
    "frc97",
    {
      bible: "frc97",
      family: "dynamic",
      label: "Francais courant 1997",
      style: "hybrid-calibrated",
      strongDensityPolicy: "semantic",
      expectedTokenCoverage: { low: 0.38, high: 0.5 },
      readerAlignment: {
        maxStrongPerWord: 2,
        minEmptySourceAgreement: 3,
        learnedTranslationMinScore: 0.43,
        learnedFunctionWordMode: "reference-only"
      },
      hardVerseThresholds: {
        lowTokenCoverage: 0.24,
        referenceDensityRatio: 0.62,
        lowOriginalConfirmation: 0.72,
        manyOriginalStrongUnplaced: 8
      },
      notes:
        "Francais courant revision with dynamic style. Lower visible density is expected; use empty Strong for necessary original inventory that is not explicitly rendered."
    }
  ],
  [
    "nbs",
    {
      bible: "nbs",
      family: "formal-readable",
      label: "Nouvelle Bible Segond",
      style: "hybrid-calibrated",
      strongDensityPolicy: "medium",
      expectedTokenCoverage: { low: 0.46, high: 0.56 },
      readerAlignment: {
        maxStrongPerWord: 3,
        minEmptySourceAgreement: 2,
        learnedTranslationMinScore: 0.38,
        learnedFunctionWordMode: "restricted"
      },
      hardVerseThresholds: {
        lowTokenCoverage: 0.27,
        referenceDensityRatio: 0.7,
        lowOriginalConfirmation: 0.72,
        manyOriginalStrongUnplaced: 6
      },
      notes:
        "Segond-family translation with relatively formal structure, but less mechanically literal than Darby."
    }
  ],
  [
    "nfc",
    {
      bible: "nfc",
      family: "dynamic",
      label: "Nouvelle francais courant",
      style: "hybrid-calibrated",
      strongDensityPolicy: "semantic",
      expectedTokenCoverage: { low: 0.38, high: 0.5 },
      readerAlignment: {
        maxStrongPerWord: 2,
        minEmptySourceAgreement: 3,
        learnedTranslationMinScore: 0.43,
        learnedFunctionWordMode: "reference-only"
      },
      hardVerseThresholds: {
        lowTokenCoverage: 0.24,
        referenceDensityRatio: 0.62,
        lowOriginalConfirmation: 0.72,
        manyOriginalStrongUnplaced: 8
      },
      notes:
        "Modern common-language translation. Favor readable semantic tags and explicit empty Strong records for unrendered source words."
    }
  ],
  [
    "nvs78p",
    {
      bible: "nvs78p",
      family: "formal-readable",
      label: "Nouvelle Version Segond revisee 1978",
      style: "hybrid-calibrated",
      strongDensityPolicy: "medium",
      expectedTokenCoverage: { low: 0.46, high: 0.56 },
      readerAlignment: {
        maxStrongPerWord: 3,
        minEmptySourceAgreement: 2,
        learnedTranslationMinScore: 0.38,
        learnedFunctionWordMode: "restricted"
      },
      hardVerseThresholds: {
        lowTokenCoverage: 0.27,
        referenceDensityRatio: 0.7,
        lowOriginalConfirmation: 0.72,
        manyOriginalStrongUnplaced: 6
      },
      notes:
        "Segond-family formal-readable translation. Similar calibration to NBS/S21 with moderate density and careful function-word handling."
    }
  ],
  [
    "ost",
    {
      bible: "ost",
      family: "formal",
      label: "Ostervald",
      style: "hybrid-calibrated",
      strongDensityPolicy: "high",
      expectedTokenCoverage: { low: 0.48, high: 0.58 },
      readerAlignment: {
        maxStrongPerWord: 4,
        minEmptySourceAgreement: 2,
        learnedTranslationMinScore: 0.34,
        learnedFunctionWordMode: "restricted"
      },
      hardVerseThresholds: {
        lowTokenCoverage: 0.29,
        referenceDensityRatio: 0.74,
        lowOriginalConfirmation: 0.72,
        manyOriginalStrongUnplaced: 5
      },
      notes:
        "Formal historical French translation. Higher density and stronger alignment to Segond/Darby-style references are expected."
    }
  ],
  [
    "s21",
    {
      bible: "s21",
      family: "formal-readable",
      label: "Segond 21",
      style: "hybrid-calibrated",
      strongDensityPolicy: "medium",
      expectedTokenCoverage: { low: 0.47, high: 0.57 },
      readerAlignment: {
        maxStrongPerWord: 3,
        minEmptySourceAgreement: 2,
        learnedTranslationMinScore: 0.38,
        learnedFunctionWordMode: "restricted"
      },
      hardVerseThresholds: {
        lowTokenCoverage: 0.27,
        referenceDensityRatio: 0.7,
        lowOriginalConfirmation: 0.72,
        manyOriginalStrongUnplaced: 6
      },
      notes:
        "Modern Segond-family translation. Expected to stay close enough to formal references while using contemporary wording."
    }
  ],
  [
    "fmar",
    {
      bible: "fmar",
      family: "formal",
      label: "Martin",
      style: "hybrid-calibrated",
      strongDensityPolicy: "high",
      expectedTokenCoverage: { low: 0.48, high: 0.58 },
      readerAlignment: {
        maxStrongPerWord: 4,
        minEmptySourceAgreement: 2,
        learnedTranslationMinScore: 0.34,
        learnedFunctionWordMode: "restricted"
      },
      hardVerseThresholds: {
        lowTokenCoverage: 0.29,
        referenceDensityRatio: 0.74,
        lowOriginalConfirmation: 0.72,
        manyOriginalStrongUnplaced: 5
      },
      notes:
        "Formal historical French translation. Higher Strong density is expected and low-density verses deserve stricter review."
    }
  ]
]);

export function getTranslationProfile(bible: string): TranslationProfile {
  return (
    PROFILES.get(bible.toLowerCase()) ?? {
      ...DEFAULT_PROFILE,
      bible: bible.toLowerCase()
    }
  );
}
