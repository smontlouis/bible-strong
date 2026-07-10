import type { Edge, Node } from "@xyflow/react";

export type WorkflowCategory =
  | "source"
  | "index"
  | "deterministic"
  | "loop"
  | "output"
  | "llm"
  | "quality";

export type WorkflowNodeData = {
  title: string;
  eyebrow: string;
  category: WorkflowCategory;
  summary: string;
  details: string[];
  inputs: string[];
  outputs: string[];
  example: string;
  commands: string[];
  files: string[];
  metrics: string[];
  guardrails: string[];
  risks: string[];
};

export const categoryLabels: Record<WorkflowCategory, string> = {
  source: "Sources",
  index: "Index SQLite",
  deterministic: "Generation",
  loop: "Boucle auto-safe",
  output: "Sorties",
  llm: "LLM borne",
  quality: "Qualite"
};

export const categoryTone: Record<
  WorkflowCategory,
  {
    border: string;
    background: string;
    chip: string;
    edge: string;
  }
> = {
  source: {
    border: "#5f8fb5",
    background: "rgba(52, 89, 120, 0.55)",
    chip: "bg-sky-500/15 text-sky-200 border-sky-400/30",
    edge: "#5f8fb5"
  },
  index: {
    border: "#70aa9a",
    background: "rgba(40, 92, 80, 0.54)",
    chip: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
    edge: "#70aa9a"
  },
  deterministic: {
    border: "#b8a565",
    background: "rgba(105, 88, 35, 0.52)",
    chip: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    edge: "#b8a565"
  },
  loop: {
    border: "#8dc074",
    background: "rgba(61, 103, 47, 0.53)",
    chip: "bg-lime-500/15 text-lime-200 border-lime-400/30",
    edge: "#8dc074"
  },
  output: {
    border: "#8fa1d6",
    background: "rgba(66, 78, 132, 0.54)",
    chip: "bg-indigo-500/15 text-indigo-200 border-indigo-400/30",
    edge: "#8fa1d6"
  },
  llm: {
    border: "#c884a5",
    background: "rgba(111, 55, 86, 0.53)",
    chip: "bg-pink-500/15 text-pink-200 border-pink-400/30",
    edge: "#c884a5"
  },
  quality: {
    border: "#d58b6a",
    background: "rgba(118, 66, 43, 0.53)",
    chip: "bg-orange-500/15 text-orange-200 border-orange-400/30",
    edge: "#d58b6a"
  }
};

export const workflowNodes: Array<Node<WorkflowNodeData>> = [
  {
    id: "target-bible",
    type: "workflowNode",
    position: { x: 0, y: 40 },
    data: {
      title: "Bible cible NBS",
      eyebrow: "Input principal",
      category: "source",
      summary:
        "Le texte francais a enrichir. Pour NBS, c'est le corpus complet qui fournit les versets, les mots visibles et la structure livre/chapitre/verset.",
      details: [
        "Cette etape ne contient pas encore de Strong fiable. Elle donne le texte cible a analyser et a annoter, par exemple les mots visibles de Exod.10.19: 'criquets' et 'criquet'.",
        "Le generateur tokenize le texte cible, conserve les index de mots et utilise ces index comme surface de placement. Toute decision visible doit finir par pointer vers un mot ou une phrase de ce texte, ou rester en tag vide si aucun porteur fiable n'existe."
      ],
      inputs: ["data/bibles/bible-nbs.json"],
      outputs: [
        "Versets tokenises",
        "References canoniques",
        "Mots francais indexes"
      ],
      example:
        "Dans Exod.10.19, le texte cible contient deux porteurs plausibles pour H0697: 'criquets' puis 'criquet'.",
      commands: ["npm run strong:generate -- --bible nbs"],
      files: ["data/bibles/bible-nbs.json"],
      metrics: ["verseCount", "wordCount"],
      guardrails: [
        "Ne pas inventer de mot cible absent du texte.",
        "Ne pas modifier le texte biblique pendant la generation."
      ],
      risks: [
        "Index de mot decale",
        "Tokenisation differente entre vue reader et ledger"
      ]
    }
  },
  {
    id: "witnesses",
    type: "workflowNode",
    position: { x: 0, y: 230 },
    data: {
      title: "Temoins Strong",
      eyebrow: "Sg1910 / Darby / DarbyR",
      category: "source",
      summary:
        "Les Bibles francaises deja taggees Strong servent de temoins. Elles ne sont pas copiees aveuglement, mais donnent des attentes de Strong et des exemples de porteurs francais.",
      details: [
        "Le pipeline compare les inventaires Strong des temoins avec le verset cible. Si plusieurs temoins placent le meme Strong sur un porteur comparable, ce signal devient fort.",
        "Ces temoins alimentent aussi le phrase-lexicon: expressions multi-mots apprises, equivalences recurrentes et preuves de reference. Ils sont essentiels pour verifier les decisions LLM apres consensus."
      ],
      inputs: ["Sg1910.csv", "Darby.csv", "DarbyR.csv"],
      outputs: [
        "Inventaires Strong par verset",
        "Supports de reference",
        "Phrases apprises"
      ],
      example:
        "Si Sg1910, Darby et DarbyR rendent un Strong par le meme type de mot francais, le placement NBS est plus defensible.",
      commands: ["npm run strong:phrase:index"],
      files: [
        "data/strongs/Sg1910.csv",
        "data/strongs/Darby.csv",
        "data/strongs/DarbyR.csv"
      ],
      metrics: [
        "referenceStrongOccurrenceCount",
        "referenceStrongCarrierCoverage"
      ],
      guardrails: [
        "Comparer les temoins, pas seulement compter un consensus brut.",
        "Conserver les supports de reference dans les diagnostics."
      ],
      risks: [
        "Temoin divergent",
        "Porteur generique soutenu par un seul temoin"
      ]
    }
  },
  {
    id: "step-originals",
    type: "workflowNode",
    position: { x: 0, y: 420 },
    data: {
      title: "STEP TAHOT / TAGNT",
      eyebrow: "Original complet",
      category: "source",
      summary:
        "TAHOT et TAGNT donnent l'inventaire original hebreu/grec. C'est la couche qui garantit que les Strong originaux restent representes, meme quand ils n'ont pas de porteur francais direct.",
      details: [
        "Chaque token original porte des informations comme classicalStrong, dStrong/eStrong, gloss, morphologie et ordre source. Le ledger garde cette preuve pour expliquer les tags reader, advanced, duplicate ou empty.",
        "Quand le francais ne rend pas explicitement un element original, on peut exposer un tag vide en mode reader si les temoins l'attendent, ou le garder en advanced/debug si c'est technique."
      ],
      inputs: ["TAHOT *.txt", "TAGNT *.txt"],
      outputs: [
        "Inventaire original",
        "Occurrences source",
        "Ordre original",
        "Gloss et morphologie"
      ],
      example:
        "H0697 dans Exod.10.19 apparait deux fois dans l'original; le systeme doit donc representer deux occurrences, pas une seule.",
      commands: ["npm run strong:step:download-originals"],
      files: [
        "data/external/stepbible/amalgamated/TAHOT *.txt",
        "data/external/stepbible/amalgamated/TAGNT *.txt"
      ],
      metrics: ["originalStrongOccurrenceCount", "originalRepresentationRate"],
      guardrails: [
        "Utiliser STEP comme inventaire de production.",
        "Ne pas traiter les suffixes WLC/SBLGNT comme cles de lookup production."
      ],
      risks: [
        "Strong technique rendu visible trop agressivement",
        "Confusion dStrong/eStrong"
      ]
    }
  },
  {
    id: "french-lexical",
    type: "workflowNode",
    position: { x: 0, y: 610 },
    data: {
      title: "Sources lexicales FR",
      eyebrow: "Preuves deterministes",
      category: "source",
      summary:
        "Les dictionnaires et ressources lexicales francaises fournissent des preuves supplementaires pour proposer des porteurs visibles sans faire appel au LLM.",
      details: [
        "On combine dictionnaire Strong FR, Kaikki, WOLF, synonymes OpenOffice, noms propres et composants numeriques. Ces sources ne suffisent pas toutes au meme niveau: une preuve directe comme seed-term ou Kaikki peut donner high, alors que le synonym-only reste material de review.",
        "Le but est de distinguer 'preuve directe exploitable' et 'indice semantique a verifier'. Cette separation evite qu'un synonyme lointain place automatiquement un Strong sur un mauvais mot."
      ],
      inputs: ["strong_fr.sqlite", "Kaikki", "WOLF", "OpenOffice synonyms"],
      outputs: [
        "Candidats lexicaux scores",
        "Sources de preuve",
        "Confiance high/medium/low"
      ],
      example:
        "Pour H0697, 'criquet' matche seed-term et Kaikki gloss 'locust', ce qui rend le candidat high-confidence.",
      commands: ["npm run strong:kaikki:index"],
      files: [
        "data/dictionaries/strong_fr.sqlite",
        "data/external/french-lexical/kaikki/kaikki.org-dictionary-French.sqlite"
      ],
      metrics: [
        "High-confidence candidates",
        "Evidence sources",
        "Reviewable candidates"
      ],
      guardrails: [
        "Synonym-only ne doit pas devenir auto-safe.",
        "Les noms propres utilisent les gloss fiables, pas les definitions larges."
      ],
      risks: [
        "Synonyme trop large",
        "Mot generique pris pour porteur semantique"
      ]
    }
  },
  {
    id: "sqlite-indexes",
    type: "workflowNode",
    position: { x: 360, y: 120 },
    data: {
      title: "Index SQLite rapides",
      eyebrow: "Performance",
      category: "index",
      summary:
        "Les grosses sources sont pre-indexees pour eviter de relire ou reconstruire des fichiers massifs a chaque generation.",
      details: [
        "Kaikki passe de gros JSONL a des lookups SQLite cibles. Le Strong phrase-lexicon passe d'une reconstruction memoire couteuse a une lecture indexee avec fingerprint de sources.",
        "C'est ce qui rend possible un rebuild NBS complet sans remonter a plusieurs gigaoctets inutiles a chaque phase. Le ledger lui-meme devient aussi SQLite-first pour les refresh scopes."
      ],
      inputs: [
        "Kaikki JSONL",
        "Sg1910/Darby/DarbyR",
        "Ledger existant optionnel"
      ],
      outputs: [
        "kaikki.org-dictionary-French.sqlite",
        "strong-phrase-lexicon.sqlite"
      ],
      example:
        "Sur Lev, le passage SQLite/index a reduit fortement la memoire et evite de reconstruire les memes structures a chaque refresh.",
      commands: ["npm run strong:kaikki:index", "npm run strong:phrase:index"],
      files: [
        "data/external/french-lexical/kaikki/kaikki.org-dictionary-French.sqlite",
        "data/derived/strong-phrase-lexicon.sqlite"
      ],
      metrics: ["Temps de chargement", "RSS", "Cache hit phrase lexicon"],
      guardrails: [
        "Verifier les fingerprints des sources.",
        "Ne pas retomber silencieusement sur les chemins JSONL lourds."
      ],
      risks: ["Index obsolete", "Fallback lent non detecte"]
    }
  },
  {
    id: "generate-command",
    type: "workflowNode",
    position: { x: 720, y: 40 },
    data: {
      title: "strong:generate",
      eyebrow: "Commande de production",
      category: "deterministic",
      summary:
        "Point d'entree principal. Il genere le ledger Strong canonique sans LLM, applique les placements auto-safe et ecrit les artefacts.",
      details: [
        "La generation production est volontairement deterministe. Elle doit etre reproductible, mesurable et explicable avant que le LLM intervienne sur des trous residuels.",
        "Le mode complet reconstruit toute la Bible. Les scopes --only sont reserves aux refresh localises ou aux tests de regression."
      ],
      inputs: [
        "Bible cible",
        "Temoins",
        "STEP",
        "Lexiques",
        "Overrides valides"
      ],
      outputs: [
        "Ledger en memoire",
        "SQLite canonique",
        "TSV reader/advanced",
        "Metrics"
      ],
      example: "Pour NBS complet: npm run strong:generate -- --bible nbs.",
      commands: ["STRONG_PERF=1 npm run strong:generate -- --bible nbs"],
      files: ["src/strongLedger.ts"],
      metrics: [
        "generate total",
        "RSS",
        "Reader coverage",
        "Advanced coverage"
      ],
      guardrails: [
        "Pas de LLM dans cette commande.",
        "Chaque placement doit garder source, confidence, diagnostics et raison."
      ],
      risks: ["Generation longue", "Regression silencieuse sur coverage"]
    }
  },
  {
    id: "load-sources",
    type: "workflowNode",
    position: { x: 720, y: 230 },
    data: {
      title: "Chargement sources",
      eyebrow: "Phase initiale",
      category: "deterministic",
      summary:
        "Le generateur charge le texte cible, les temoins, STEP, les dictionnaires et les indexes utiles en memoire controlee.",
      details: [
        "Cette phase doit rester rapide et observable via STRONG_PERF. Elle est separee de l'alignement pour savoir si une lenteur vient de l'I/O, des indexes ou du calcul.",
        "Les logs typiques montrent read target bible, load Strong references, load STEP originals, build Strong lexicon, load dictionary candidates, read phrase lexicon sqlite."
      ],
      inputs: ["Fichiers source", "Indexes SQLite"],
      outputs: [
        "Structures de reference",
        "Lexiques prets",
        "Originals merges"
      ],
      example:
        "Un run sain affiche le phrase-lexicon SQLite en moins d'une seconde au lieu de reconstruire tout l'index.",
      commands: ["STRONG_PERF=1 npm run strong:generate -- --bible nbs"],
      files: [
        "src/strongLedger.ts",
        "src/stepOriginals.ts",
        "src/strongPhraseLexiconStore.ts"
      ],
      metrics: [
        "load Strong references",
        "load STEP originals",
        "load phrase lexicon"
      ],
      guardrails: [
        "Loguer les phases lourdes.",
        "Eviter les lectures globales quand un scope suffit."
      ],
      risks: ["Memoire initiale trop haute", "Fallback JSON non indexe"]
    }
  },
  {
    id: "reader-alignment",
    type: "workflowNode",
    position: { x: 1080, y: 120 },
    data: {
      title: "Alignement reader",
      eyebrow: "Visible normal",
      category: "deterministic",
      summary:
        "Cette phase cherche les placements visibles defensibles pour le mode lecteur, a partir des temoins et de la traduction cible.",
      details: [
        "Le reader privilegie ce qu'un utilisateur doit voir normalement: Strong sur mots ou phrases francaises fiables, avec une limite profile-aware pour eviter le sur-tagging.",
        "Les placements peuvent venir de temoins directs, de phrase-transfer, de dictionnaire francais ou d'overrides deja valides."
      ],
      inputs: ["Verset NBS", "Temoins Strong", "Lexicon", "Profil NBS"],
      outputs: [
        "Annotations reader word/phrase/empty",
        "Diagnostics par annotation"
      ],
      example:
        "Un Strong peut etre pose sur une expression comme 'un seul' si les temoins montrent cette correspondance multi-mots.",
      commands: ["npm run strong:generate -- --bible nbs --only Exod.10.19"],
      files: ["src/readerAlignment.ts", "src/phraseTranslationLexicon.ts"],
      metrics: ["readerVisibleStrongCount", "readerTaggedTokenCount"],
      guardrails: [
        "Ne pas empiler plusieurs Strong visibles sur un mot sans preuve.",
        "Respecter le profil de traduction NBS."
      ],
      risks: ["Sur-tagging reader", "Phrase trop large"]
    }
  },
  {
    id: "complete-alignment",
    type: "workflowNode",
    position: { x: 1080, y: 330 },
    data: {
      title: "Alignement complete",
      eyebrow: "Original/advanced",
      category: "deterministic",
      summary:
        "Cette phase complete le ledger avec les occurrences originales non visibles: empty, duplicate, hidden ou advanced.",
      details: [
        "Le but est que l'inventaire original soit presque totalement represente, meme si tout ne doit pas apparaitre en mode reader.",
        "Les tags advanced/debug expliquent l'ordre source, les doublons, les Strong techniques et les cas ou aucun porteur francais fiable n'existe."
      ],
      inputs: ["STEP originals", "Reader annotations", "Temoins"],
      outputs: [
        "Advanced annotations",
        "Duplicate/empty/original-complete",
        "Inventaire complet"
      ],
      example:
        "Une particule grecque ou hebraique peut rester advanced si elle n'a pas d'equivalent francais naturel.",
      commands: ["npm run strong:export -- --bible nbs --view advanced"],
      files: ["src/completeAlignment.ts", "src/stepOriginals.ts"],
      metrics: [
        "advancedStrongCount",
        "emptyStrongCount",
        "originalRepresentationRate"
      ],
      guardrails: [
        "Representer l'original sans forcer un faux mot francais.",
        "Distinguer reader et advanced."
      ],
      risks: ["Tag technique visible en reader", "Original non represente"]
    }
  },
  {
    id: "ledger-build",
    type: "workflowNode",
    position: { x: 1440, y: 230 },
    data: {
      title: "Ledger canonique",
      eyebrow: "Source de verite",
      category: "deterministic",
      summary:
        "Le ledger assemble tokens, annotations, inventaires, vues HTML et metriques par verset. C'est l'artefact central de production.",
      details: [
        "Chaque annotation garde son id, Strong, visibility, placement, source, confidence, reason, diagnostics, indices de mots et preuve STEP si disponible.",
        "Le ledger n'est pas seulement une exportation visuelle: c'est un journal explicable des raisons pour lesquelles chaque Strong est visible, vide, hidden ou advanced."
      ],
      inputs: [
        "Alignement reader",
        "Alignement complete",
        "Profil",
        "Overrides"
      ],
      outputs: [
        "StrongLedgerVerse[]",
        "views reader/advanced/debug",
        "Metrics par verset"
      ],
      example:
        "Exod.10.19 contient deux annotations H0697 distinctes, chacune avec son occurrence originale et son placement cible.",
      commands: [
        "sqlite3 outputs/strong/nbs/bible-nbs-strong.sqlite 'select count(*) from verses'"
      ],
      files: [
        "outputs/strong/nbs/bible-nbs-strong.sqlite",
        "src/strongLedgerStore.ts"
      ],
      metrics: ["verse.metrics", "inventories.reader", "inventories.advanced"],
      guardrails: [
        "SQLite est l'artefact canonique.",
        "Ne pas revenir aux anciens dossiers split JSON comme source de verite."
      ],
      risks: ["Ledger incomplet", "Views non synchronisees apres mutation"]
    }
  },
  {
    id: "lexical-report",
    type: "workflowNode",
    position: { x: 1800, y: 40 },
    data: {
      title: "Rapport candidats lexicaux",
      eyebrow: "Detection",
      category: "loop",
      summary:
        "A partir du ledger courant, le systeme liste les Strong vides ou suspects et leurs porteurs francais possibles avec scores et preuves.",
      details: [
        "Le rapport distingue les items empty et relocation. Chaque candidat porte target, wordIndex ou range phrase, texte, normalized, score, confidence, occupied et evidence.",
        "Ce rapport sert deux usages: appliquer automatiquement les cas auto-safe et produire une queue residuelle pour review humaine ou LLM."
      ],
      inputs: ["Ledger courant", "Sources lexicales", "Inventaire original"],
      outputs: [
        "items[]",
        "candidates[]",
        "groupAutoSafe",
        "metrics de rapport"
      ],
      example:
        "Pour H0697, le rapport voit deux candidats high 'criquets' et 'criquet' et peut les grouper en ordre source.",
      commands: [
        "npm run strong:lexical-candidates -- --bible nbs --only Exod.10.19"
      ],
      files: [
        "src/lexicalCandidateReport.ts",
        "outputs/lexical-candidates/nbs/*.json"
      ],
      metrics: [
        "Candidate count",
        "Auto-safe candidates",
        "High-confidence ambiguous items"
      ],
      guardrails: [
        "Un candidat high n'est pas automatiquement applique.",
        "Les candidats occupes restent bloques sauf regle de stacking explicite."
      ],
      risks: ["Rapport trop large", "Ambiguite masquee par score eleve"]
    }
  },
  {
    id: "auto-safe-rules",
    type: "workflowNode",
    position: { x: 2160, y: 40 },
    data: {
      title: "Regles auto-safe",
      eyebrow: "Decision deterministe",
      category: "loop",
      summary:
        "Cette etape extrait uniquement les placements qui satisfont des conditions mecaniquement sures. Elle ne fait pas de raisonnement libre.",
      details: [
        "Les cas acceptables incluent les candidats directs non ambigus, les phrases auxiliaire+participe avec preuve directe, les composants numeriques et les groupes doublons resolus par ordre et cardinalite.",
        "Le systeme garde un filtre fort: porteurs generiques, synonym-only, stacking suspect ou conflits de cible restent dans le residuel."
      ],
      inputs: [
        "Rapport candidats",
        "Occupations reader",
        "Regles de confiance"
      ],
      outputs: ["LexicalAutoSafePlacement[]"],
      example:
        "Deux H0697 et deux porteurs 'criquets'/'criquet' donnent un group-auto-safe si l'ordre source mappe proprement l'ordre francais.",
      commands: ["npm run strong:generate -- --bible nbs --only Exod.10.19"],
      files: ["src/lexicalCandidateReport.ts", "src/strongLedger.ts"],
      metrics: ["applied", "changedRefs", "groupAutoSafe items"],
      guardrails: [
        "Consensus lexical exact ne suffit pas si la cible est generique.",
        "Stacking autorise seulement pour regles explicites comme numeric/group."
      ],
      risks: [
        "Faux positif lexical",
        "Meme mot recevant deux Strong non compatibles"
      ]
    }
  },
  {
    id: "apply-autosafe",
    type: "workflowNode",
    position: { x: 2160, y: 250 },
    data: {
      title: "Application auto-safe",
      eyebrow: "Mutation ledger",
      category: "loop",
      summary:
        "Les placements auto-safe transforment des annotations empty/advanced en annotations reader visibles source=semantic-lexicon.",
      details: [
        "L'annotation conserve son id et son occurrence originale, mais change visibility, placement, source, confidence, reason, diagnostics et indices de cible.",
        "Apres chaque application, les cibles occupees sont mises a jour pour eviter qu'un autre placement se pose au meme endroit sans autorisation."
      ],
      inputs: ["LexicalAutoSafePlacement[]", "Ledger en memoire"],
      outputs: ["Annotations semantic-lexicon", "changedRefs"],
      example:
        "H0697 Exod.10.19:32 devient reader/word sur wordIndex 12 'criquets', confidence 0.9.",
      commands: ["STRONG_PERF=1 npm run strong:generate -- --bible nbs"],
      files: ["src/strongLedger.ts"],
      metrics: ["applied", "changedRefs.size", "RSS"],
      guardrails: [
        "Ne changer que les annotations applicables.",
        "Rejeter si la cible est deja occupee hors regle de stacking."
      ],
      risks: [
        "Occupation non recalculée",
        "Annotation deja visible deplacee a tort"
      ]
    }
  },
  {
    id: "rebuild-changed",
    type: "workflowNode",
    position: { x: 1800, y: 420 },
    data: {
      title: "Rebuild versets changes",
      eyebrow: "Incremental",
      category: "loop",
      summary:
        "Apres application, seuls les versets modifies sont recalcules: inventaires, metriques et HTML reader/advanced/debug.",
      details: [
        "Cette optimisation evite de reconstruire toute la Bible a chaque mini-placement. Elle garde le ledger coherent localement et reduit le travail des passes suivantes.",
        "Le point important: un placement auto-safe dans un verset ne peut debloquer que ce meme verset. Les passes suivantes peuvent donc se limiter a changedRefs."
      ],
      inputs: ["changedRefs", "Annotations mises a jour"],
      outputs: [
        "Inventaires recalcules",
        "Views HTML a jour",
        "Metrics verset"
      ],
      example:
        "Sur Exod.10.19, apres deux H0697 appliques, seul ce verset doit etre regenere pour confirmer applied=0 au tour suivant.",
      commands: ["npm run strong:generate -- --bible nbs --only Exod.10.19"],
      files: ["src/strongLedger.ts", "src/render.ts"],
      metrics: ["passVerses.length", "changedRefs"],
      guardrails: [
        "Ne pas garder un scope cumulatif trop large.",
        "Toujours recalculer les vues apres mutation."
      ],
      risks: ["Views stale", "Passes suivantes trop couteuses"]
    }
  },
  {
    id: "stabilization-gate",
    type: "workflowNode",
    position: { x: 1800, y: 250 },
    data: {
      title: "Gate applied = 0",
      eyebrow: "Stabilisation",
      category: "loop",
      summary:
        "La boucle s'arrete seulement quand une passe ne trouve plus aucun placement auto-safe a appliquer.",
      details: [
        "Une seule passe ne suffit pas: placer un Strong peut enlever une ambiguite, liberer un groupe ou changer l'etat d'occupation d'un verset.",
        "La borne maximale protege contre les boucles infinies, mais le resultat mature attendu est applied=0 avec zero auto-safe restant dans le rapport residuel."
      ],
      inputs: ["applied", "changedRefs", "Pass limit"],
      outputs: ["Ledger stabilise ou warning de limite"],
      example:
        "Le test Exod.10.19 converge en deux passes: applied=2 puis applied=0.",
      commands: ["STRONG_PERF=1 npm run strong:generate -- --bible nbs"],
      files: ["src/strongLedger.ts"],
      metrics: ["lexical auto-safe pass n", "applied", "verses"],
      guardrails: [
        "Ne pas declarer production-ready si des auto-safe restent.",
        "Logger un warning si la limite est atteinte."
      ],
      risks: ["Limite atteinte avec residuel auto-safe", "Passes trop larges"]
    }
  },
  {
    id: "residual-report",
    type: "workflowNode",
    position: { x: 2160, y: 490 },
    data: {
      title: "Rapport residuel",
      eyebrow: "Queue review",
      category: "output",
      summary:
        "Quand le determinisme a fini, le rapport restant documente ce qui n'a pas ete applique automatiquement.",
      details: [
        "Ce rapport est la frontiere saine entre determinisme et review. Il contient les trous, relocations, candidats faibles, ambiguities high, stacking suspect et cas qui meritent LLM/humain.",
        "Il sert aussi de test de maturite: apres une generation complete, on attend zero auto-safe residuel. Ce qui reste doit etre volontairement non automatique."
      ],
      inputs: ["Ledger stabilise", "Rapport candidats final"],
      outputs: ["bible-nbs-lexical-candidates-all.json", "Markdown lisible"],
      example:
        "Avant correction de la boucle, le residuel global gardait deux H0697 Exod.10.19 auto-safe; c'etait un signal que la stabilisation n'etait pas terminee.",
      commands: [
        "jq '.items | length' outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-all.json"
      ],
      files: [
        "outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-all.json",
        "outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-all.md"
      ],
      metrics: [
        "Auto-safe candidates",
        "Reviewable candidates",
        "Relocation items"
      ],
      guardrails: [
        "Ne pas appliquer le residuel brut.",
        "Utiliser ce rapport pour construire des packets bornes."
      ],
      risks: ["Residuel ignore", "LLM appele sur des cas faibles non priorises"]
    }
  },
  {
    id: "write-artifacts",
    type: "workflowNode",
    position: { x: 2520, y: 200 },
    data: {
      title: "Ecriture artefacts",
      eyebrow: "Production outputs",
      category: "output",
      summary:
        "Le pipeline ecrit le SQLite canonique, les TSV reader/advanced, les metrics et le rapport lexical.",
      details: [
        "SQLite est la source de verite pour les workflows suivants. Les TSV sont des vues exportees pour consommation ou inspection.",
        "Les outputs complets restent ignores par Git. On commit le code et les fixtures utiles, pas les Bibles completes generees."
      ],
      inputs: ["Ledger stabilise", "Metrics globales", "Views HTML"],
      outputs: [
        "bible-nbs-strong.sqlite",
        "reader.tsv",
        "advanced.tsv",
        "metrics.json"
      ],
      example:
        "Apres generation NBS, le SQLite contient 31 169 versets et les TSV reader/advanced sont reecrits.",
      commands: [
        "npm run strong:export -- --bible nbs --view reader",
        "npm run strong:export -- --bible nbs --view advanced"
      ],
      files: [
        "outputs/strong/nbs/bible-nbs-strong.sqlite",
        "outputs/strong/nbs/bible-nbs-strong-reader.tsv",
        "outputs/strong/nbs/bible-nbs-strong-advanced.tsv",
        "outputs/strong/nbs/bible-nbs-strong-metrics.json"
      ],
      metrics: ["write ledger artifacts", "File size", "verseCount"],
      guardrails: [
        "Ne pas commit les outputs full Bible.",
        "Garder SQLite comme artefact canonique."
      ],
      risks: ["Fichier partiel", "TSV non synchronise avec SQLite"]
    }
  },
  {
    id: "validation",
    type: "workflowNode",
    position: { x: 2880, y: 200 },
    data: {
      title: "Validation production",
      eyebrow: "Checks",
      category: "quality",
      summary:
        "On verifie que le ledger est lisible, complet, coherent et que les metriques ne regressent pas.",
      details: [
        "Les checks minimaux: count versets, sqlite integrity_check, coverage reader/advanced, originalRepresentationRate, placementRiskCount et zero auto-safe residuel.",
        "Les changements de logique deterministe doivent aussi passer typecheck, lint, tests, build et audit 10x5 quand le rayon d'impact le justifie."
      ],
      inputs: ["SQLite", "Metrics", "Rapport residuel", "Tests"],
      outputs: [
        "Signal pret/non pret",
        "Rapports de regression",
        "Baseline mise a jour si necessaire"
      ],
      example:
        "Un run NBS sain doit afficher 31 169 versets, integrity_check ok et original representation proche de 1.",
      commands: [
        "sqlite3 outputs/strong/nbs/bible-nbs-strong.sqlite 'pragma integrity_check'",
        "npm run typecheck",
        "npm test",
        "npm run build"
      ],
      files: [
        "outputs/strong/nbs/bible-nbs-strong-metrics.json",
        "tests/fixtures/strong-audit/nbs-10x5-snapshot.json"
      ],
      metrics: [
        "reader coverage",
        "advanced coverage",
        "placementRiskCount",
        "originalRepresentationRate"
      ],
      guardrails: [
        "Ne pas confondre generation terminee et qualite validee.",
        "Inspecter les deltas quand une regle change."
      ],
      risks: [
        "Regression cachee par une coverage globale stable",
        "Risque placement positif"
      ]
    }
  },
  {
    id: "llm-packet",
    type: "workflowNode",
    position: { x: 2520, y: 520 },
    data: {
      title: "Packet LLM borne",
      eyebrow: "Apres determinisme",
      category: "llm",
      summary:
        "Le LLM n'est appele qu'apres la generation deterministe, sur un packet limite de trous ou relocations clairement decrits.",
      details: [
        "Le packet donne au modele le contexte procedural: auditKind, currentTarget, sourcePlacement, nearbyOpenTargets, blockedTargets, occupiedTargets, availableTargets et warnings.",
        "On ne demande pas au LLM de 'trouver la meilleure Bible'. On lui demande de trancher un petit nombre de cas audites avec contraintes fortes."
      ],
      inputs: ["Rapport residuel", "Gap candidates", "Ledger courant"],
      outputs: ["agent-packet-*.json"],
      example:
        "Un chapitre peut contenir 30 candidats semantic-medium max pour comparer deux propositions LLM sans lancer une Bible entiere.",
      commands: [
        "npm run strong:review:gaps:lexical-packet -- --bible nbs --only Gen.1 --limit 30 --min-confidence medium"
      ],
      files: [
        "src/semanticRefillAgentPacket.ts",
        "src/semanticRefillLexicalPacket.ts"
      ],
      metrics: ["Packet size", "min-priority", "candidate count"],
      guardrails: [
        "Pas de whole-Bible LLM aveugle.",
        "Ne pas payer pour un packet sans candidats forts."
      ],
      risks: ["Contexte insuffisant", "Packet trop large"]
    }
  },
  {
    id: "two-proposers",
    type: "workflowNode",
    position: { x: 2880, y: 520 },
    data: {
      title: "Deux proposers",
      eyebrow: "Redondance LLM",
      category: "llm",
      summary:
        "Deux modeles independants proposent des decisions. On cherche les accords robustes, pas une autorite unique.",
      details: [
        "Le workflow benchmarke utilise un proposer A et un proposer B avec parametrages differents. Chaque sortie doit etre validee mecaniquement avant application.",
        "Cette redondance reduit les hallucinations, mais ne suffit pas: deux modeles peuvent encore etre d'accord sur un mauvais porteur generique."
      ],
      inputs: ["Agent packet", "Modele A", "Modele B"],
      outputs: ["Review A", "Review B", "Validation dirs"],
      example:
        "Si les deux modeles choisissent le meme Strong, meme cible et meme decision avec confiance haute, il peut entrer dans le consensus exact.",
      commands: [
        "npm run strong:review:gaps:llm -- --input <packet> --output <review> --model <model>"
      ],
      files: ["outputs/gap-review/nbs/agent-review/*.json"],
      metrics: ["accepted", "pending", "invalid decisions", "confidence"],
      guardrails: [
        "Valider chaque review avant consensus.",
        "Ne pas utiliser pending-human comme final."
      ],
      risks: [
        "Consensus sur mauvaise cible",
        "Modele invente une troisieme voie"
      ]
    }
  },
  {
    id: "consensus-filter",
    type: "workflowNode",
    position: { x: 3240, y: 520 },
    data: {
      title: "Consensus + filtre",
      eyebrow: "Securite",
      category: "llm",
      summary:
        "Le consensus exact extrait les accords, puis un filtre automatique retient les cas dangereux avant application.",
      details: [
        "Le filtre post-consensus est obligatoire. Il retient les porteurs generiques comme 'faire', 'vais', 'fit', 'celle' si les temoins ne soutiennent pas clairement le meme carrier.",
        "Il inspecte aussi le stacking meme cible, les decisions original-only sans support temoin et les deltas de risque positifs. Un consensus LLM n'est donc pas une autorisation de production."
      ],
      inputs: ["Review A", "Review B", "Witness checks", "Risk metrics"],
      outputs: [
        "Review consensus",
        "Review auto-filtered",
        "Rapport held/safe"
      ],
      example:
        "Rom.4.17 G5607 -> 'existe' a ete retenu car visible sans token witness ni support Strong dans les temoins.",
      commands: [
        "npm run strong:review:gaps:consensus -- --left-review <a> --right-review <b> --output <consensus>",
        "npm run strong:review:gaps:filter -- --review <consensus> --output <filtered>"
      ],
      files: [
        "src/semanticRefillConsensusReview.ts",
        "src/semanticRefillConsensusFilter.ts"
      ],
      metrics: ["safe decisions", "held decisions", "placementRiskCount delta"],
      guardrails: [
        "Exact consensus ne suffit pas.",
        "Inspecter les temoins avant stacking."
      ],
      risks: ["Porteur generique faux", "Risque placement positif"]
    }
  },
  {
    id: "validated-overrides",
    type: "workflowNode",
    position: { x: 3600, y: 520 },
    data: {
      title: "Overrides valides",
      eyebrow: "Retour deterministe",
      category: "llm",
      summary:
        "Les decisions filtrees et acceptees deviennent des overrides audites. Elles ne remplacent pas le generateur: elles l'alimentent au prochain run.",
      details: [
        "Une decision appliquee doit garder sa provenance, sa confidence, sa raison et sa cible. Les low-confidence ou empty fallbacks restent visibles comme tels en review.",
        "Le cycle mature boucle ensuite vers strong:generate. Le resultat final est encore une Bible generee par pipeline deterministe, enrichie par decisions validees."
      ],
      inputs: ["Review filtered", "Apply validated", "Human review si besoin"],
      outputs: ["curated-strong-overrides.json", "Ledger regenere"],
      example:
        "Les decisions Lev filtrees ont ete appliquees, puis la regeneration a mesure emptyStrongCount -15 et placementRiskCount -5 sur le scope.",
      commands: [
        "npm run strong:review:gaps:apply -- --bible nbs --input <filtered> --apply",
        "npm run strong:generate -- --bible nbs"
      ],
      files: [
        "data/curated-strong-overrides.json",
        "src/curatedStrongOverrides.ts"
      ],
      metrics: [
        "emptyStrongCount delta",
        "readerTaggedTokenCount delta",
        "placementRiskCount delta"
      ],
      guardrails: [
        "Ne jamais appliquer raw single-model review.",
        "Recalculer le ledger apres application."
      ],
      risks: ["Override obsolete", "Decision non auditable"]
    }
  },
  {
    id: "xstate-optional",
    type: "workflowNode",
    position: { x: 720, y: 610 },
    data: {
      title: "XState optionnel",
      eyebrow: "Etat live",
      category: "quality",
      summary:
        "XState n'est pas necessaire pour documenter le workflow, mais peut modeliser l'etat live d'un run: idle, loading, aligning, lexical_loop, writing, validating, done.",
      details: [
        "React Flow sert a documenter la carte complete. XState serait utile plus tard si on veut brancher un runner live avec progression, retries, erreurs et transitions observees.",
        "Ce n'est pas le moteur de generation. C'est une representation UI d'etat, pratique pour afficher ou reprendre un run long."
      ],
      inputs: ["Logs STRONG_PERF", "Etat process", "Artefacts attendus"],
      outputs: ["Machine d'etat UI", "Progression visualisable"],
      example:
        "Pendant une generation NBS, la machine pourrait passer de lexical_loop.pass=1 a lexical_loop.pass=2 avec applied/changingRefs affiches.",
      commands: ["Non requis maintenant"],
      files: ["Future UI only"],
      metrics: ["current phase", "elapsed", "last pass applied"],
      guardrails: [
        "Ne pas confondre documentation et orchestration.",
        "Ne pas ajouter XState tant qu'il n'y a pas de besoin live."
      ],
      risks: ["Complexite prematuree", "Etat UI divergent du vrai process"]
    }
  }
];

export const workflowEdges: Edge[] = [
  edge("target-bible", "load-sources"),
  edge("witnesses", "sqlite-indexes"),
  edge("step-originals", "load-sources"),
  edge("french-lexical", "sqlite-indexes"),
  edge("sqlite-indexes", "load-sources"),
  edge("load-sources", "reader-alignment"),
  edge("load-sources", "complete-alignment"),
  edge("generate-command", "load-sources"),
  edge("reader-alignment", "ledger-build"),
  edge("complete-alignment", "ledger-build"),
  edge("ledger-build", "lexical-report"),
  edge("lexical-report", "auto-safe-rules"),
  edge("auto-safe-rules", "apply-autosafe"),
  edge("apply-autosafe", "rebuild-changed"),
  edge("rebuild-changed", "stabilization-gate"),
  edge("stabilization-gate", "lexical-report", "loop"),
  edge("stabilization-gate", "residual-report"),
  edge("ledger-build", "write-artifacts"),
  edge("residual-report", "write-artifacts"),
  edge("write-artifacts", "validation"),
  edge("residual-report", "llm-packet"),
  edge("llm-packet", "two-proposers"),
  edge("two-proposers", "consensus-filter"),
  edge("consensus-filter", "validated-overrides"),
  edge("validated-overrides", "generate-command", "loop"),
  edge("generate-command", "xstate-optional")
];

function edge(
  source: string,
  target: string,
  tone: "normal" | "loop" = "normal"
): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    animated: tone === "loop",
    type: "smoothstep",
    style: {
      stroke: tone === "loop" ? "#c884a5" : "#62717d",
      strokeWidth: tone === "loop" ? 2.4 : 1.8
    }
  };
}
