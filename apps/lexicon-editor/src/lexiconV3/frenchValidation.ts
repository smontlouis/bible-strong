import { isGenericFrenchCarrier } from "../frenchLexicalSafety.js";
import { tokenizeText } from "../tokenize.js";
import { lintLexiconGloss } from "./lexiconGlossQuality.js";
import type { RequiredFrenchEntityMention } from "./frenchEntityMentions.js";

export const FRENCH_PROPOSAL_SCHEMA_VERSION =
  "lexicon-v3-french-proposal@3" as const;

export type FrenchIssueSeverity = "info" | "warning" | "blocking";

export interface FrenchValidationIssue {
  code: string;
  severity: FrenchIssueSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface FrenchLexiconProposal {
  schemaVersion: typeof FRENCH_PROPOSAL_SCHEMA_VERSION;
  entryKey: string;
  derivedFromEnglishHash: string;
  model: string;
  glossFr: string;
  meaningSegmentsFr: Array<{ id: string; text: string }>;
  entityMentionsFr: FrenchEntityMentionTranslation[];
  meaningFr: string;
  meaningHtmlFr: string;
  notesFr: string;
  carrierTermsFr: string[];
  confidence: number;
}

export interface FrenchEntityMentionTranslation {
  mentionId: string;
  segmentId: string;
  chosenFrenchForm: string;
}

export interface FrenchConcordanceForm {
  surface: string;
  normalized: string;
  count: number;
  /** Number of distinct classical Strong codes using this French form. */
  strongCount: number;
  witnessFamilies: string[];
  sources: string[];
}

export interface FrenchValidationContext {
  entryKey: string;
  englishHash: string;
  englishStatus:
    | "validated"
    | "human_validated"
    | "review_needed"
    | "source_issue";
  englishGloss: string;
  englishMeaning: string;
  original: string;
  morph?: string;
  sourceStrongCodes?: string[];
  sourceReferences?: string[];
  legacyGloss?: string;
  legacyMeaning?: string;
  concordanceForms: FrenchConcordanceForm[];
  requiredEntityMentions?: RequiredFrenchEntityMention[];
}

export interface FrenchValidationResult {
  issues: FrenchValidationIssue[];
  canPublishDisplay: boolean;
  requiresHumanReview: boolean;
}

export interface FrenchCarrierDecision {
  surface: string;
  normalized: string;
  state: "auto_validated" | "candidate" | "blocked";
  policy: "auto_safe" | "review_only" | "blocked";
  confidence: number;
  witnessFamilies: string[];
  sources: string[];
  reason: string;
}

export interface FrenchModelExecutionProof {
  actualModel: string | null;
  provider: string | null;
  identity: string | null;
  verified: boolean;
}

export interface FrenchAutoEligibilityInput {
  proposalA: FrenchLexiconProposal;
  proposalB: FrenchLexiconProposal;
  arbiterProposal: FrenchLexiconProposal;
  validationA: FrenchValidationResult;
  validationB: FrenchValidationResult;
  arbiterValidation: FrenchValidationResult;
  models: { proposerA: string; proposerB: string; arbiter: string };
  modelProofs: Record<
    "proposerA" | "proposerB" | "arbiter",
    FrenchModelExecutionProof
  >;
  arbiterVerdict: "accept" | "review_needed";
  arbiterReasons: string[];
  englishStatus: FrenchValidationContext["englishStatus"];
}

export interface FrenchAutoEligibilityResult {
  eligible: boolean;
  reasons: string[];
}

const SAFE_HTML_TAGS = new Set([
  "b",
  "br",
  "def",
  "em",
  "greek",
  "i",
  "lb",
  "note",
  "p",
  "ref",
  "span",
  "strong",
  "sup",
  "u"
]);
const VOID_HTML_TAGS = new Set(["br", "lb"]);

const ENGLISH_RESIDUE_PATTERN =
  /(?<![\p{L}\p{M}\p{N}_])(?:namely|hence|properly|figuratively|metaphorically|therefore|chiefly|usually|especially|outside|except|meaning|spelling)(?![\p{L}\p{M}\p{N}_])/iu;

const FRENCH_BIBLE_BOOK_ALIASES: Record<string, string[]> = {
  Gen: ["Gen", "Gn", "Genese", "Genesis"],
  Exod: ["Exod", "Exo", "Ex", "Exode"],
  Lev: ["Lev", "Lv", "Levitique"],
  Num: ["Num", "Nom", "Nombres"],
  Deut: ["Deut", "Deu", "Dt", "Deuteronome"],
  Josh: ["Josh", "Jos", "Josue"],
  Judg: ["Judg", "Jdg", "Jg", "Jug", "Juges"],
  Ruth: ["Ruth", "Rut"],
  "1Sam": ["1Sam", "1Sa", "1 Samuel"],
  "2Sam": ["2Sam", "2Sa", "2 Samuel"],
  "1Kgs": ["1Kgs", "1Ki", "1R", "1 R", "1Ro", "1 Ro", "1 Rois"],
  "2Kgs": ["2Kgs", "2Ki", "2R", "2 R", "2Ro", "2 Ro", "2 Rois"],
  "3Kgs": ["3Kgs", "3Ki", "3R", "3 R", "3Ro", "3 Ro", "3 Rois"],
  "4Kgs": ["4Kgs", "4Ki", "4R", "4 R", "4Ro", "4 Ro", "4 Rois"],
  "1Chr": ["1Chr", "1 Chr", "1Ch", "1 Ch", "1 Chroniques"],
  "2Chr": ["2Chr", "2 Chr", "2Ch", "2 Ch", "2 Chroniques"],
  Ezra: ["Ezra", "Ezr", "Esd", "Esdras"],
  Neh: ["Neh", "Ne", "Nehemie"],
  Esth: ["Esth", "Est", "Esther"],
  Job: ["Job", "Jb"],
  Ps: ["Ps", "Psa", "Psaume", "Psaumes"],
  Prov: ["Prov", "Pro", "Pr", "Proverbes"],
  Eccl: ["Eccl", "Ecc", "Ecclesiaste"],
  Song: ["Song", "Sng", "Ca", "Cant", "Cantique", "Cantique des cantiques"],
  Isa: ["Isa", "Es", "Esa", "Esaie", "Isaie"],
  Jer: ["Jer", "Jr", "Jeremie"],
  Lam: ["Lam", "Lamentations"],
  Ezek: ["Ezek", "Ezk", "Ez", "Eze", "Ezech", "Ezechiel"],
  Dan: ["Dan", "Da", "Daniel"],
  Hos: ["Hos", "Os", "Osee"],
  Joel: ["Joel", "Joe", "Jol"],
  Amos: ["Amos", "Amo"],
  Obad: ["Obad", "Oba", "Abdias"],
  Jonah: ["Jonah", "Jon", "Jonas"],
  Mic: ["Mic", "Mi", "Michee"],
  Nah: ["Nah", "Nahum"],
  Hab: ["Hab", "Habacuc"],
  Zeph: ["Zeph", "Zep", "Sophonie"],
  Hag: ["Hag", "Aggee"],
  Zech: ["Zech", "Zec", "Zac", "Zacharie"],
  Mal: ["Mal", "Malachie"],
  Matt: ["Matt", "Mat", "Mt", "Matthieu"],
  Mark: ["Mark", "Mrk", "Mk", "Mc", "Mar", "Marc"],
  Luke: ["Luke", "Luk", "Lk", "Lc", "Luc"],
  John: ["John", "Jhn", "Jn", "Jean"],
  Acts: ["Acts", "Act", "Ac", "Actes"],
  Rom: ["Rom", "Rm", "Romains"],
  "1Cor": ["1Cor", "1Co", "1 Co", "1 Corinthiens"],
  "2Cor": ["2Cor", "2Co", "2 Co", "2 Corinthiens"],
  Gal: ["Gal", "Ga", "Galates"],
  Eph: ["Eph", "Ep", "Ephesiens"],
  Phil: ["Phil", "Php", "Ph", "Philippiens"],
  Col: ["Col", "Colossiens"],
  "1Thess": ["1Thess", "1Th", "1 Th", "1 Thess", "1 Thessaloniciens"],
  "2Thess": ["2Thess", "2Th", "2 Th", "2 Thess", "2 Thessaloniciens"],
  "1Tim": ["1Tim", "1Ti", "1 Ti", "1 Tim", "1 Timothee"],
  "2Tim": ["2Tim", "2Ti", "2 Ti", "2 Tim", "2 Timothee"],
  Titus: ["Titus", "Tit", "Tt", "Tite"],
  Phlm: ["Phlm", "Phm", "Philemon"],
  Heb: ["Heb", "He", "Hebreux"],
  Jas: ["Jas", "Jc", "Jac", "Jacques"],
  "1Pet": ["1Pet", "1Pe", "1Pi", "1 Pi", "1 Pierre"],
  "2Pet": ["2Pet", "2Pe", "2Pi", "2 Pi", "2 Pierre"],
  "1John": ["1John", "1Jhn", "1Jo", "1Jn", "1 Jn", "1 Jean"],
  "2John": ["2John", "2Jhn", "2Jo", "2Jn", "2 Jn", "2 Jean"],
  "3John": ["3John", "3Jhn", "3Jo", "3Jn", "3 Jn", "3 Jean"],
  Jude: ["Jude"],
  Rev: ["Rev", "Re", "Ap", "Apo", "Apocalypse"],
  Tob: ["Tob", "Tobie"],
  Jdt: ["Jdt", "Jdth", "Judith"],
  Wis: ["Wis", "Sag", "Sg", "Sagesse"],
  Sir: ["Sir", "Siracide"],
  Bar: ["Bar", "Baruch"],
  "1Macc": ["1Macc", "1Mac", "1Ma", "1 Maccabees"],
  "2Macc": ["2Macc", "2Mac", "2Ma", "2 Maccabees"],
  "3Macc": ["3Macc", "3Mac", "3Ma", "3 Maccabees"],
  "4Macc": ["4Macc", "4Mac", "4Ma", "4 Maccabees"]
};

const KNOWN_FALSE_FRIENDS: Array<{
  english: RegExp;
  french: RegExp;
  code: string;
  expected: string;
}> = [
  {
    english: /^scroll$/iu,
    french: /\bd[ée]fil/iu,
    code: "false-friend-scroll",
    expected: "rouleau"
  },
  {
    english: /^branch$/iu,
    french: /\bsuccursale\b/iu,
    code: "false-friend-branch",
    expected: "branche, pousse ou rejeton"
  },
  {
    english: /^eye[- ]service$/iu,
    french: /ophtalm/iu,
    code: "false-friend-eye-service",
    expected: "service accompli sous le regard du maître"
  },
  {
    english: /^cleaving$/iu,
    french: /\bfend/iu,
    code: "false-friend-cleaving",
    expected: "adhérent ou attaché"
  },
  {
    english: /^to jest$/iu,
    french: /c['’]est[- ]?[àa][- ]dire/iu,
    code: "false-friend-jest",
    expected: "plaisanter ou railler"
  },
  {
    english: /^to bring up$/iu,
    french: /\babord/iu,
    code: "false-friend-bring-up",
    expected: "élever ou nourrir"
  },
  {
    english: /^capital$/iu,
    french: /^capital$/iu,
    code: "false-friend-capital-noun",
    expected: "capitale"
  }
];

export function validateFrenchProposal(
  proposal: FrenchLexiconProposal,
  context: FrenchValidationContext
): FrenchValidationResult {
  const issues: FrenchValidationIssue[] = [];

  if (proposal.schemaVersion !== FRENCH_PROPOSAL_SCHEMA_VERSION) {
    issues.push(blocking("invalid-schema-version", "Contrat FR v3 invalide."));
  }
  if (proposal.entryKey !== context.entryKey) {
    issues.push(
      blocking("entry-key-mismatch", "La proposition vise une autre entrée.")
    );
  }
  if (proposal.derivedFromEnglishHash !== context.englishHash) {
    issues.push(
      blocking(
        "stale-english-version",
        "La proposition française ne dérive pas de la version anglaise courante."
      )
    );
  }
  if (context.englishStatus === "source_issue") {
    issues.push(
      blocking(
        "blocked-by-english-source",
        "La source anglaise doit être résolue avant de valider le français."
      )
    );
  } else if (context.englishStatus === "review_needed") {
    issues.push({
      code: "english-review-needed",
      severity: "warning",
      message: "La version anglaise reste à revoir."
    });
  }

  validateRequiredText(proposal, issues);
  if (proposal.notesFr.trim()) {
    issues.push({
      code: "translator-notes-present",
      severity: "warning",
      message: "Une note du traducteur signale une réserve et impose une revue."
    });
  }
  validateGlossForm(proposal, context, issues);
  validateHtml(proposal, issues);
  validateEntityMentions(proposal, context, issues);
  validateProtectedContent(proposal, context, issues);
  validateConfidence(proposal.confidence, issues);

  const hasBlocking = issues.some((issue) => issue.severity === "blocking");
  const hasWarning = issues.some((issue) => issue.severity === "warning");
  return {
    issues,
    canPublishDisplay: !hasBlocking,
    requiresHumanReview:
      hasBlocking ||
      hasWarning ||
      !["validated", "human_validated"].includes(context.englishStatus)
  };
}

export function validateFrenchEntityMentions(
  proposal: Pick<
    FrenchLexiconProposal,
    "meaningSegmentsFr" | "entityMentionsFr"
  >,
  requiredMentions: readonly RequiredFrenchEntityMention[]
): FrenchValidationIssue[] {
  const issues: FrenchValidationIssue[] = [];
  const segmentById = new Map<string, string>();
  for (const segment of proposal.meaningSegmentsFr) {
    if (
      !segment ||
      typeof segment.id !== "string" ||
      !segment.id.trim() ||
      typeof segment.text !== "string" ||
      segmentById.has(segment.id)
    ) {
      issues.push(
        blocking(
          "invalid-entity-mention-segments",
          "Les segments français nécessaires au contrôle des entités sont invalides."
        )
      );
      return issues;
    }
    segmentById.set(segment.id, segment.text);
  }
  if (!Array.isArray(proposal.entityMentionsFr)) {
    return [
      blocking(
        "invalid-entity-mentions-output",
        "La couverture structurée des entités est absente."
      )
    ];
  }
  const requiredById = new Map(
    requiredMentions.map((mention) => [mention.mentionId, mention])
  );
  if (requiredById.size !== requiredMentions.length) {
    return [
      blocking(
        "duplicate-required-entity-mention",
        "Le registre source contient un identifiant d’entité dupliqué."
      )
    ];
  }
  const exact = requiredMentions.filter(
    (mention) => mention.resolution === "exact"
  );
  const blockingMentions = requiredMentions.filter(
    (mention) => mention.resolution === "ambiguous"
  );
  if (blockingMentions.length > 0) {
    issues.push(
      blocking(
        "ambiguous-entity-mention-source",
        "Une mention d’entité ambiguë devait être résolue avant traduction."
      )
    );
  }
  const outputById = new Map<string, FrenchEntityMentionTranslation>();
  for (const output of proposal.entityMentionsFr) {
    if (
      !output ||
      typeof output.mentionId !== "string" ||
      typeof output.segmentId !== "string" ||
      typeof output.chosenFrenchForm !== "string" ||
      !output.chosenFrenchForm.trim() ||
      outputById.has(output.mentionId)
    ) {
      issues.push(
        blocking(
          "invalid-entity-mention-output",
          "Une décision structurée d’entité est invalide ou dupliquée."
        )
      );
      continue;
    }
    outputById.set(output.mentionId, output);
    const required = requiredById.get(output.mentionId);
    if (!required || required.resolution !== "exact") {
      issues.push(
        blocking(
          "unexpected-entity-mention-output",
          "Une décision a été rendue pour une mention absente ou non-entité."
        )
      );
      continue;
    }
    if (output.segmentId !== required.segmentId) {
      issues.push(
        blocking(
          "entity-mention-segment-mismatch",
          "La décision d’entité vise un autre segment que la source."
        )
      );
    }
    const chosen = normalizeFrenchEntityForm(output.chosenFrenchForm);
    const allowed = new Set(
      required.allowedFrenchForms.map(normalizeFrenchEntityForm)
    );
    if (!chosen || !allowed.has(chosen)) {
      issues.push(
        blocking(
          "entity-mention-form-not-allowed",
          "La forme française choisie n’appartient pas à la politique canonique."
        )
      );
    }
    const segmentText = required.segmentId
      .split("+")
      .map((segmentId) => segmentById.get(segmentId) ?? "")
      .join(" ");
    if (
      !segmentText.trim() ||
      !containsNormalizedFrenchForm(segmentText, output.chosenFrenchForm)
    ) {
      issues.push(
        blocking(
          "entity-mention-form-missing-from-segment",
          "La forme d’entité choisie n’apparaît pas dans le segment français correspondant."
        )
      );
    }
  }
  for (const required of exact) {
    if (!outputById.has(required.mentionId)) {
      issues.push(
        blocking(
          "missing-entity-mention-output",
          "Une mention d’entité exacte n’a pas de décision française."
        )
      );
    }
  }
  return issues;
}

function validateEntityMentions(
  proposal: FrenchLexiconProposal,
  context: FrenchValidationContext,
  issues: FrenchValidationIssue[]
): void {
  issues.push(
    ...validateFrenchEntityMentions(
      proposal,
      context.requiredEntityMentions ?? []
    )
  );
}

export function buildConsensusCarrierTerms(
  left: FrenchLexiconProposal,
  right: FrenchLexiconProposal,
  arbiter: FrenchLexiconProposal,
  context: FrenchValidationContext
): FrenchCarrierDecision[] {
  if (
    left.entryKey !== context.entryKey ||
    right.entryKey !== context.entryKey ||
    arbiter.entryKey !== context.entryKey ||
    left.derivedFromEnglishHash !== context.englishHash ||
    right.derivedFromEnglishHash !== context.englishHash ||
    arbiter.derivedFromEnglishHash !== context.englishHash ||
    new Set(
      [left.model, right.model, arbiter.model].map((model) =>
        model.trim().toLowerCase()
      )
    ).size !== 3
  ) {
    return [];
  }

  const leftTerms = normalizedTermMap(left.carrierTermsFr);
  const rightTerms = normalizedTermMap(right.carrierTermsFr);
  const arbiterTerms = normalizedTermMap(arbiter.carrierTermsFr);
  const decisions: FrenchCarrierDecision[] = [];

  for (const [normalized, surface] of leftTerms) {
    if (!rightTerms.has(normalized)) continue;
    const evidence = context.concordanceForms.filter(
      (form) => form.normalized === normalized
    );
    const witnessFamilies = [
      ...new Set(evidence.flatMap((form) => form.witnessFamilies))
    ].sort();
    const sources = [
      ...new Set(evidence.flatMap((form) => form.sources))
    ].sort();
    const generic = isGenericFrenchCarrier(normalized);
    const englishReady =
      context.englishStatus === "validated" ||
      context.englishStatus === "human_validated";

    if (!englishReady || generic || evidence.length === 0) {
      decisions.push({
        surface,
        normalized,
        state: "blocked",
        policy: "blocked",
        confidence: Math.min(
          left.confidence,
          right.confidence,
          arbiter.confidence,
          0.5
        ),
        witnessFamilies,
        sources,
        reason: !englishReady
          ? "english-not-validated"
          : generic
            ? "generic-french-carrier"
            : "no-exact-french-witness"
      });
      continue;
    }

    const independent = witnessFamilies.length >= 2;
    const globallyUnambiguous = evidence.every(
      (form) => form.strongCount === 1
    );
    const arbiterConfirmed = arbiterTerms.has(normalized);
    const autoSafe = independent && globallyUnambiguous && arbiterConfirmed;
    decisions.push({
      surface,
      normalized,
      state: autoSafe ? "auto_validated" : "candidate",
      policy: autoSafe ? "auto_safe" : "review_only",
      confidence: Math.min(
        left.confidence,
        right.confidence,
        arbiter.confidence,
        autoSafe ? 0.92 : 0.74
      ),
      witnessFamilies,
      sources,
      reason: autoSafe
        ? "three-model-consensus-and-two-witness-families"
        : !arbiterConfirmed
          ? "arbiter-did-not-confirm"
          : independent && !globallyUnambiguous
            ? `ambiguous-across-${Math.max(...evidence.map((form) => form.strongCount))}-strongs`
            : "three-model-consensus-with-single-witness-family"
    });
  }

  return decisions.sort((a, b) => a.normalized.localeCompare(b.normalized));
}

export function normalizeFrenchCarrierTerm(value: string): string {
  const words = tokenizeText(value)
    .filter((segment) => segment.kind === "word")
    .map((segment) => segment.normalized);
  return words.join(" ").trim();
}

export function evaluateFrenchAutoEligibility(
  input: FrenchAutoEligibilityInput
): FrenchAutoEligibilityResult {
  const proposals = [input.proposalA, input.proposalB, input.arbiterProposal];
  const validations = [
    input.validationA,
    input.validationB,
    input.arbiterValidation
  ];
  const declaredModels = [
    input.models.proposerA,
    input.models.proposerB,
    input.models.arbiter
  ].map(normalizeModelIdentity);
  const proposalModels = proposals.map((proposal) =>
    normalizeModelIdentity(proposal.model)
  );
  const executionProofs = [
    input.modelProofs.proposerA,
    input.modelProofs.proposerB,
    input.modelProofs.arbiter
  ];
  const glosses = proposals.map((proposal) =>
    normalizeFrenchCarrierTerm(proposal.glossFr)
  );
  const meanings = proposals.map((proposal) =>
    normalizeFrenchDisplayText(proposal.meaningFr)
  );
  const reasons: string[] = [];

  if (proposalModels.some((model, index) => model !== declaredModels[index])) {
    reasons.push("model-identity-mismatch");
  }
  if (
    executionProofs.some(
      (proof) =>
        !proof.verified ||
        !proof.actualModel ||
        !proof.provider ||
        !proof.identity
    )
  ) {
    reasons.push("model-execution-unverified");
  }
  if (
    executionProofs.some(
      (proof, index) =>
        Boolean(proof.actualModel && proof.provider && proof.identity) &&
        (normalizeModelIdentity(proof.identity ?? "") !==
          normalizeModelIdentity(
            composeFrenchModelIdentity(
              proof.provider ?? "",
              proof.actualModel ?? ""
            )
          ) ||
          normalizeModelIdentity(proof.identity ?? "") !==
            declaredModels[index])
    )
  ) {
    reasons.push("model-execution-identity-mismatch");
  }
  if (new Set(proposalModels).size !== 3) {
    reasons.push("model-identity-not-independent");
  }
  if (!glosses[0] || !glosses.every((gloss) => gloss === glosses[0])) {
    reasons.push("gloss-disagreement");
  }
  if (!meanings[0] || !meanings.every((meaning) => meaning === meanings[0])) {
    reasons.push("meaning-disagreement");
  }
  if (
    validations.some(
      (validation) =>
        !validation.canPublishDisplay ||
        validation.requiresHumanReview ||
        validation.issues.length > 0
    )
  ) {
    reasons.push("validator-not-clean");
  }
  if (input.arbiterVerdict !== "accept") reasons.push("arbiter-not-accepted");
  if (input.arbiterReasons.length > 0) reasons.push("arbiter-has-reservations");
  if (input.arbiterProposal.confidence < 0.9) {
    reasons.push("arbiter-confidence-below-threshold");
  }
  if (!["validated", "human_validated"].includes(input.englishStatus)) {
    reasons.push("english-not-validated");
  }

  return { eligible: reasons.length === 0, reasons };
}

function normalizeFrenchDisplayText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("fr")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeModelIdentity(value: string): string {
  return value.trim().toLowerCase();
}

export function composeFrenchModelIdentity(
  provider: string,
  actualModel: string
): string {
  const normalizedProvider = provider.trim().replace(/\/+$/gu, "");
  const normalizedModel = actualModel.trim().replace(/^\/+/gu, "");
  if (!normalizedProvider || !normalizedModel) return "";
  return normalizedModel
    .toLowerCase()
    .startsWith(`${normalizedProvider.toLowerCase()}/`)
    ? normalizedModel
    : `${normalizedProvider}/${normalizedModel}`;
}

export function stripLexiconHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function validateRequiredText(
  proposal: FrenchLexiconProposal,
  issues: FrenchValidationIssue[]
): void {
  if (!proposal.glossFr.trim()) {
    issues.push(blocking("empty-french-gloss", "Le gloss français est vide."));
  }
  if (!proposal.meaningFr.trim()) {
    issues.push(
      blocking("empty-french-meaning", "La définition française est vide.")
    );
  }
  if (!proposal.meaningHtmlFr.trim()) {
    issues.push(
      blocking("empty-french-meaning-html", "La définition HTML est vide.")
    );
  }
}

function validateGlossForm(
  proposal: FrenchLexiconProposal,
  context: FrenchValidationContext,
  issues: FrenchValidationIssue[]
): void {
  const gloss = proposal.glossFr.trim();
  if (gloss.length > 140) {
    issues.push({
      code: "gloss-too-long",
      severity: "warning",
      message: "Le gloss ressemble à une définition plutôt qu’à une vedette."
    });
  }
  for (const lintIssue of lintLexiconGloss({
    language: "fr",
    gloss,
    morph: context.morph,
    counterpartGloss: context.englishGloss
  })) {
    issues.push({
      code: lintIssue.code.replace(/^french-/u, ""),
      severity: lintIssue.status === "source_issue" ? "blocking" : "warning",
      message:
        lintIssue.status === "source_issue"
          ? "Le gloss français est manifestement incomplet."
          : "Un gloss lexical ne doit normalement pas finir par une phrase."
    });
  }
  if (/^to\s+/iu.test(context.englishGloss) && /^pour\s+/iu.test(gloss)) {
    issues.push({
      code: "verb-gloss-not-infinitive",
      severity: "warning",
      message: "Le verbe français doit être donné à l’infinitif, sans « pour »."
    });
  }
  if (ENGLISH_RESIDUE_PATTERN.test(`${gloss} ${proposal.meaningFr}`)) {
    issues.push(
      blocking(
        "residual-english",
        "La traduction contient encore du vocabulaire éditorial anglais."
      )
    );
  }
  for (const rule of KNOWN_FALSE_FRIENDS) {
    if (
      rule.english.test(context.englishGloss.trim()) &&
      rule.french.test(gloss)
    ) {
      issues.push({
        code: rule.code,
        severity: "blocking",
        message: `Faux ami probable; sens attendu : ${rule.expected}.`
      });
    }
  }
}

function validateHtml(
  proposal: FrenchLexiconProposal,
  issues: FrenchValidationIssue[]
): void {
  issues.push(
    ...validateLexiconHtmlPair(proposal.meaningFr, proposal.meaningHtmlFr)
  );
}

export function validateLexiconHtmlPair(
  valueText: string,
  valueHtml: string
): FrenchValidationIssue[] {
  const issues: FrenchValidationIssue[] = [];
  const html = valueHtml;
  const tagTokens = [...html.matchAll(/<[^>]*>/gu)];
  const openTags: string[] = [];
  let malformedNesting = false;
  for (const match of tagTokens) {
    const token = match[0];
    const parsed = /^<\s*(\/?)\s*([a-z][a-z0-9-]*)\s*(\/?)\s*>$/iu.exec(token);
    if (!parsed) {
      issues.push(
        blocking(
          "unsafe-html-attribute",
          "Les attributs et syntaxes HTML non canoniques sont interdits."
        )
      );
      continue;
    }
    const tag = (parsed[2] ?? "").toLowerCase();
    if (!SAFE_HTML_TAGS.has(tag)) {
      issues.push(
        blocking("unsafe-html-tag", `Balise HTML non autorisée : ${tag}.`)
      );
      continue;
    }

    const closing = parsed[1] === "/";
    const selfClosing = parsed[3] === "/";
    if (closing && selfClosing) {
      malformedNesting = true;
      continue;
    }
    if (VOID_HTML_TAGS.has(tag)) {
      if (closing) malformedNesting = true;
      continue;
    }
    if (selfClosing) {
      malformedNesting = true;
      continue;
    }
    if (!closing) {
      openTags.push(tag);
      continue;
    }
    if (openTags.at(-1) !== tag) {
      malformedNesting = true;
      continue;
    }
    openTags.pop();
  }
  if (openTags.length > 0) malformedNesting = true;
  if (malformedNesting) {
    issues.push(
      blocking(
        "malformed-html-nesting",
        "Les balises HTML doivent être correctement fermées et imbriquées."
      )
    );
  }
  const outsideTags = html.replace(/<[^>]*>/gu, "");
  if (/[<>]/u.test(outsideTags)) {
    issues.push(
      blocking("unsafe-html-syntax", "Syntaxe HTML incomplète ou ambiguë.")
    );
  }
  const plain = normalizeComparable(stripLexiconHtml(html));
  const expected = normalizeComparable(valueText);
  if (
    plain !== expected &&
    normalizeVisibleTokens(plain) !== normalizeVisibleTokens(expected)
  ) {
    issues.push(
      blocking(
        "meaning-text-html-divergence",
        "Le texte simple et le HTML ne proviennent pas de la même définition."
      )
    );
  }
  return issues;
}

function normalizeVisibleTokens(value: string): string {
  return (
    value
      .normalize("NFKC")
      .toLocaleLowerCase("fr")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).join(" ");
}

function validateProtectedContent(
  proposal: FrenchLexiconProposal,
  context: FrenchValidationContext,
  issues: FrenchValidationIssue[]
): void {
  const translated = `${proposal.glossFr} ${proposal.meaningFr} ${proposal.meaningHtmlFr}`;
  const normalizedReferenceText = normalizeReferenceText(translated);
  for (const strong of context.sourceStrongCodes ?? []) {
    if (!translated.includes(strong)) {
      issues.push({
        code: "missing-source-strong",
        severity: "warning",
        message: `Le code Strong ${strong} présent dans la source a disparu.`
      });
    }
  }
  for (const reference of context.sourceReferences ?? []) {
    if (
      !containsEquivalentBibleReferenceNormalized(
        normalizedReferenceText,
        reference
      )
    ) {
      issues.push({
        code: "missing-source-reference",
        severity: "warning",
        message: `La référence ${reference} présente dans la source a disparu.`
      });
    }
  }
  for (const originalToken of extractOriginalScriptTokens(
    context.englishMeaning,
    context.original
  )) {
    if (!translated.includes(originalToken)) {
      issues.push({
        code: "missing-source-original-token",
        severity: "warning",
        message: `La forme originale ${originalToken} présente dans la notice a disparu.`
      });
    }
  }
}

export function containsEquivalentBibleReference(
  translated: string,
  canonicalReference: string
): boolean {
  return containsEquivalentBibleReferenceNormalized(
    normalizeReferenceText(translated),
    canonicalReference
  );
}

function containsEquivalentBibleReferenceNormalized(
  normalized: string,
  canonicalReference: string
): boolean {
  const match = canonicalReference.match(/^([1-4]?[A-Za-z]+)\.(\d+)\.(\d+)$/u);
  if (!match) return normalized.includes(normalizeReferenceText(canonicalReference));
  const [, book = "", chapter = "", verse = ""] = match;
  const aliases = FRENCH_BIBLE_BOOK_ALIASES[book] ?? [book];
  const aliasesPattern = aliases
    .map(normalizeReferenceText)
    .sort((left, right) => right.length - left.length)
    .map((alias) => alias.split(/\s+/u).map(escapeRegExp).join("\\s*"))
    .join("|");
  const anchorPattern = new RegExp(
    `(?:^|[^a-z0-9])(?:${aliasesPattern})(?:\\s+(?:th|lxx))?\\s*[.]?\\s*(\\d{1,3})\\s*[:.]\\s*(\\d{1,3})(?:\\s*[-–—]\\s*\\d{1,3})?`,
    "gu"
  );
  for (const anchor of normalized.matchAll(anchorPattern)) {
    let activeChapter = Number(anchor[1]);
    if (
      activeChapter === Number(chapter) &&
      Number(anchor[2]) === Number(verse)
    ) {
      return true;
    }
    let remainder = normalized.slice(anchor.index + anchor[0].length);
    const ibidChapterVerse = new RegExp(
      `^[\\s\\S]{0,240}\\bib\\.?\\s*${escapeRegExp(chapter)}\\s*[:.]\\s*${escapeRegExp(verse)}(?!\\d)`,
      "u"
    );
    if (ibidChapterVerse.test(remainder)) return true;
    const ibidVerse = new RegExp(
      `^[\\s\\S]{0,240}\\bib\\.?\\s*${escapeRegExp(verse)}(?!\\d)`,
      "u"
    );
    if (activeChapter === Number(chapter) && ibidVerse.test(remainder)) {
      return true;
    }
    while (remainder.length > 0) {
      const chapterContinuation =
        /^(?:\s*[,;]\s*|\s+)(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-–—]\s*\d{1,3})?/u.exec(
          remainder
        );
      if (chapterContinuation) {
        activeChapter = Number(chapterContinuation[1]);
        if (
          activeChapter === Number(chapter) &&
          Number(chapterContinuation[2]) === Number(verse)
        ) {
          return true;
        }
        remainder = remainder.slice(chapterContinuation[0].length);
        continue;
      }
      const verseContinuation =
        /^\s*[,;]\s*(\d{1,3})(?!\d)(?!\s*[:.]\s*\d)/u.exec(remainder);
      if (!verseContinuation) break;
      const continuedVerse = Number(verseContinuation[1]);
      const afterContinuation = remainder.slice(verseContinuation[0].length);
      // A leading 1–4 immediately followed by a book name belongs to a
      // numbered book (`1 Cor`), not to the preceding chapter. Larger verse
      // numbers may legitimately precede the next compact STEP reference, as
      // in `Luk.2:11, 26 Jhn.1:41`.
      if (continuedVerse <= 4 && /^\s*\p{L}/u.test(afterContinuation)) break;
      if (
        activeChapter === Number(chapter) &&
        continuedVerse === Number(verse)
      ) {
        return true;
      }
      remainder = afterContinuation;
    }
  }
  return false;
}

function normalizeReferenceText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function extractOriginalScriptTokens(
  englishMeaning: string,
  identityOriginal: string
): string[] {
  const script =
    /[\p{Script=Greek}\p{Script=Hebrew}][\p{Script=Greek}\p{Script=Hebrew}\p{Mark}]*/gu;
  const identity = new Set(identityOriginal.match(script) ?? []);
  return [
    ...new Set(
      (englishMeaning.match(script) ?? []).filter(
        (token) => token.length > 1 || identity.has(token)
      )
    )
  ].sort();
}

function validateConfidence(
  confidence: number,
  issues: FrenchValidationIssue[]
): void {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    issues.push(
      blocking("invalid-confidence", "Confiance hors intervalle 0–1.")
    );
  } else if (confidence < 0.84) {
    issues.push({
      code: "low-confidence",
      severity: "warning",
      message: "La proposition reste sous le seuil de validation automatique."
    });
  }
}

function normalizedTermMap(values: string[]): Map<string, string> {
  const terms = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeFrenchCarrierTerm(value);
    if (normalized && !terms.has(normalized))
      terms.set(normalized, value.trim());
  }
  return terms;
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .trim();
}

export function normalizeFrenchEntityForm(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("fr")
    .replace(/[’]/gu, "'")
    .replace(/[‐‑‒–—]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim();
}

function containsNormalizedFrenchForm(text: string, form: string): boolean {
  const haystack = normalizeFrenchEntityForm(text);
  const needle = normalizeFrenchEntityForm(form);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`,
    "u"
  ).test(haystack);
}

function blocking(code: string, message: string): FrenchValidationIssue {
  return { code, severity: "blocking", message };
}
