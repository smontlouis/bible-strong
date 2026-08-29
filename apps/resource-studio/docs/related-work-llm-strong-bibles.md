# Related Work: LLMs, AI, and Strong-Tagged Bibles

Date: 2026-06-23

Ce document rassemble les projets, discussions et ressources trouves autour de l'idee d'utiliser des LLMs ou des methodes automatiques pour creer, enrichir ou aligner des Bibles taggees Strong.

Conclusion courte: il existe plusieurs travaux tres proches, mais peu de projets publics semblent publier explicitement une pipeline complete "LLM -> nouvelle Bible Strong complete -> evaluation robuste -> export utilisable". Les precedents publics se divisent surtout en deux familles:

- pipelines modernes agentiques/LLM pour generer ou aligner des ressources bibliques;
- outils et datasets non-LLM pour alignement, Strong, morphologie, formats bibliques et evaluation.

## Precedents directs

### scruffian/farsi-strongs

Lien: https://github.com/scruffian/farsi-strongs

Description du repo: "Farsi bible with Strong's numbers, generated automatically".

Pertinence:

- C'est le precedent public le plus direct trouve pour "Bible non anglaise + Strong + generation automatique".
- Ce n'est pas un projet LLM moderne, mais le probleme est quasiment le meme: transferer des Strong vers une traduction cible.
- Le repo contient des notebooks/scripts qui utilisent traduction Farsi -> anglais, Strong/morphologie, WordNet, Word2Vec/transvec et similarites par verset.

Notes techniques observees:

- `Translation_Notebook.ipynb` commence par "Tagging NMV with strongs numbers".
- Le notebook cherche a faire correspondre des mots farsi avec des mots anglais portant des tags Strong.
- Une etape genere des "Strong sentences" par verset.
- Une autre etape construit un modele bilingue Strong/Farsi via word vectors.
- Le projet note lui-meme une difficulte importante: choisir la meilleure combinaison d'alignements dans un verset sans dupliquer les Strong.

Implication pour notre projet:

- Confirme que l'approche automatique a deja ete tentee sur une Bible cible.
- Confirme que le probleme central n'est pas seulement lexical, mais combinatoire: plusieurs mots cibles peuvent correspondre a plusieurs mots sources dans un meme verset.
- Offre une piste historique a comparer avec notre approche: word vectors/alignement statistique vs LLM contraint + references Strong francaises.

### Logos Community: ChatGPT pour ajouter des Strong

Lien: https://community.logos.com/forums/topic/224945-can-logos-add-strongs-numbers-to-a-translation/

Pertinence:

- Discussion de janvier 2025.
- Un utilisateur indique avoir traduit la LXX et essaye d'utiliser ChatGPT pour assigner des numeros Strong/APB+ a sa traduction.
- Il rapporte des erreurs typiques: mauvais numeros, numeros assignes a des mots qui ne devraient pas en avoir.

Implication pour notre projet:

- Confirme que d'autres personnes ont pense a utiliser ChatGPT/LLM pour assigner des Strong.
- Confirme aussi le risque central: un LLM libre hallucine ou sur-assigne.
- Renforce la decision d'utiliser le LLM seulement sous contraintes fortes: references, alignements, schemas de sortie, validation mecanique et scoring.

## Projets LLM proches

### unfoldingWord/bp-assistant-skills

Lien: https://github.com/unfoldingWord/bp-assistant-skills

Description du repo: "AI-assisted creation of unfoldingWord Book Packages (BP) -- ULT, UST, translation notes, translation questions, chapter intros, and word-level alignments -- driven entirely by Claude Code skills."

Pertinence:

- C'est le projet moderne le plus proche de notre direction.
- Il genere ULT, UST, translation notes, translation questions, chapter intros et alignements.
- Il utilise Claude Code et des skills.
- Il combine LLM et scripts deterministes.

Architecture importante:

- "Code where verifiable, prompts where judgment is needed."
- Les scripts gerent les taches mecaniques et verifiables: parsing USFM, extraction de citations hebreues, TSV split/merge, generation d'IDs, git/Door43, validations.
- Le LLM gere les decisions semantiques: traduction, identification d'issues, redaction de notes, alignement.

Etapes de pipeline documentees:

- `ULT-gen`: Hebrew USFM -> literal English ULT.
- `UST-gen`: T4T -> meaning-based English UST.
- `tn-writer`: generation de translation notes.
- `ULT-alignment`: alignement mot-a-mot Hebrew -> ULT.
- `UST-alignment`: alignement phrase/concept Hebrew -> UST.
- `makeBP`: orchestration de book package.

Details tres pertinents:

- Les donnees source incluent Hebrew USFM avec Strong, lemmas et morphologie.
- Le skill `ULT-gen` impose de ne pas deviner le vocabulaire, et de consulter un index Strong, glossaires, quick refs et precedents publies.
- Le skill `ULT-alignment` demande au LLM de produire un JSON d'alignement indexe, puis un script convertit ce JSON en USFM aligne.
- Le skill `UST-alignment` distingue explicitement alignement mot-a-mot et alignement de sens/phrase.

Implication pour notre projet:

- C'est une validation forte de l'architecture hybride: LLM pour jugement, code pour structure, validation et export.
- Leur separation ULT/UST ressemble a notre separation "Bible formelle vs dynamique".
- Leur usage d'un Strong index et de references publiees est proche de notre idee de s'appuyer sur `Sg1910`, `Darby`, `DarbyR` plutot que de demander au LLM de tout inventer.
- Leur workflow d'alignement JSON -> USFM aligne pourrait inspirer une sortie intermediaire robuste pour nos Bibles francaises.

### klappy/translation-helps-mcp

Lien: https://github.com/klappy/translation-helps-mcp

Description: MCP/RAG gateway pour donner a des agents IA acces aux ressources Door43: ULT, UST, translation notes, translation words, translation questions, translation academy.

Pertinence:

- Pas un generateur de Bible Strong.
- Mais tres pertinent comme couche RAG pour agents bibliques.
- Le repo documente une architecture multi-agent: orchestrateur, scripture agent, notes agent, words agent, academy agent, questions agent, search agent.
- Il inclut validation de citations pour reduire les hallucinations.

Implication pour notre projet:

- Bon exemple d'architecture ou l'agent ne repond pas depuis sa memoire, mais via ressources bibliques citees et reverifiees.
- Peut inspirer une couche de contexte pour LLM review ou semantic refill.

### klappy/conversational-bible-translation-poc

Lien: https://github.com/klappy/conversational-bible-translation-poc

Pertinence:

- Preuve de concept autour de traduction biblique conversationnelle.
- Pas de preuve trouvee d'un pipeline Strong complet.

Implication:

- Signale que des experimentations IA + traduction biblique existent dans l'ecosysteme unfoldingWord/klappy.

### klappy/obt-helper-gpt

Lien: https://github.com/klappy/obt-helper-gpt

Description du repo: "Modern AI-powered tools for everyone. Built with SvelteKit and OpenAI."

Pertinence:

- Projet IA/OpenAI adjacent a Open Bible Translation.
- Pas de pipeline Strong complet identifie.

### Clear-Bible/CommonEval

Lien: https://github.com/Clear-Bible/CommonEval

Description: repo public avec donnees et code pour benchmarks LLM.

Pertinence:

- Pas lie directement aux Strong.
- Important pour l'idee d'evaluer les LLMs dans un domaine chretien/biblique.

Implication:

- Confirme que Biblica/Clear-Bible investissent aussi dans l'evaluation LLM.
- Pour notre projet, il faut penser "benchmark" et pas seulement generation.

## Outils et datasets d'alignement biblique

### unfoldingWord/wordMAP

Lien: https://github.com/unfoldingWord/wordMAP

Description: "Multi-Lingual Word Alignment Prediction".

Pertinence:

- Outil non-LLM pour predire des alignements entre texte primaire et texte secondaire.
- Use cases declares: aligner texte primaire/secondaire, fournir suggestions vocabulaire en contexte, prevenir incoherences, pre-traduire.
- Fonctionne avec peu de donnees et sans serveur lourd.

Implication:

- Ancienne tentative solide de resoudre le coeur du probleme: alignement multilingue biblique.
- Potentiellement utile comme baseline algorithmique ou inspiration pour le scoring.

### Clear-Bible/Alignments

Lien: https://github.com/Clear-Bible/Alignments

Description: "Word alignments for Bibles, including both automatic alignments and manually corrected alignments."

Pertinence:

- Datasets d'alignement pour Bibles.
- Objectif: fournir les meilleurs alignements disponibles par langue/traduction.
- Lie au standard Scripture Burrito Alignment.

Implication:

- Tres utile pour comprendre les formats d'alignement robustes.
- Source potentielle de gold standards ou de methodes d'evaluation.

### Clear-Bible/biblealignlib

Lien: https://github.com/Clear-Bible/biblealignlib

Description: code Python pour travailler avec les donnees d'alignement Bible.

Pertinence:

- Supporte donnees d'alignement, automatic alignment, verification, scoring.
- Mentionne eflomal pour alignement automatique.
- Les notebooks incluent scoring par precision, recall, F1, AER.
- Les tokens source portent des metadonnees linguistiques: lemma, morphology, Strong's numbers.

Implication:

- Tres important pour notre idee d'evaluer les tags produits.
- Peut inspirer une evaluation gold similaire a notre masked-gold evaluation `Sg1910` / `Darby` / `DarbyR`.

### Clear-Bible/macula-hebrew

Lien: https://github.com/Clear-Bible/macula-hebrew

Description: syntax trees, morphology and linguistic annotations for the Hebrew Bible.

Contenu utile:

- Westminster Leningrad Codex.
- Open Scriptures Hebrew Bible morphology.
- Syntax trees.
- Word sense data UBS MARBLE.
- Cherith glosses.
- Semantic roles.
- Participant referents.
- Strong's numbers for Hebrew and Greek equivalents.
- TSV word-level data.

Implication:

- Source riche pour l'original hebreu.
- Utile si on veut verifier que les Strong places en francais correspondent a des mots originaux plausibles.
- Peut aussi servir a detecter les cas ou une traduction dynamique regroupe ou explicite plusieurs mots originaux.

### Clear-Bible/macula-greek

Lien: https://github.com/Clear-Bible/macula-greek

Description: syntax trees, morphology and linguistic annotations for the Greek Bible.

Contenu utile:

- Nestle1904.
- SBLGNT.
- Syntax trees.
- English glosses.
- Word sense data UBS MARBLE / Louw-Nida.
- Semantic roles.
- Participant referents.
- TSV word-level data.

Implication:

- Source riche pour NT grec.
- Utile pour validation source-aware, mais probablement a ne pas utiliser comme unique base de placement lecteur.

### schierlm/aligned-bible-corpus-data

Lien: https://github.com/schierlm/aligned-bible-corpus-data

Description: "Mapping/aligning different Bible editions, variants, corpora and apparatuses."

Pertinence:

- Contient `hebrew.csv`, `hebrew_mini.csv`, `greek.csv`, `greek_mini.csv`, `greekstrongs.csv`.
- Mappe TAHOT, OSHB, LHB, UHB, UXLC, TAGNT, SBLGNT, MorphGNT, RP05, RP18, UGNT, etc.
- Inclut Strong, morphologie, lemmes, roots, semantic dictionary refs selon les fichiers.

Implication:

- Tres utile pour normaliser les editions originales.
- Peut aider a relier des Strong provenant de sources differentes.
- Peut eviter de confondre des differences d'edition avec des erreurs de tagging.

### STEPBible-Data

Lien miroir observe via Schierl: https://github.com/schierlm/STEPBible-Data

Lien upstream connu: https://github.com/STEPBible/STEPBible-Data

Pertinence:

- Donnees Tyndale/STEP Bible sous CC BY.
- Inclut TAGNT, TAHOT, lexiques Extended Strongs, tags ESV, morphologie, versification.
- Les Extended Strongs sont compatibles avec les Strong originaux.
- Le README mentionne des descriptions creees par Claude 3 AI pour certains datasets de proper names / concept word groups.

Implication:

- Tres bonne base lexicale et morphologique.
- Pour notre projet, utile comme reference secondaire, surtout pour lexique et validation des Strong.

## Outils de formats et export

### schierlm/BibleMultiConverter

Lien: https://github.com/schierlm/BibleMultiConverter

Description: convertisseur Java entre formats bibliques.

Formats pertinents:

- USFM 2 import/export.
- USX 2/USX 3 import/export.
- OSIS.
- SWORD import.
- MyBible.Zone.
- e-Sword.
- Logos via workflow HTML/DOCX.
- Original Languages with tagging: MorphGNT, OSHB MorphBB, Unicode/XML Leningrad Codex, TAHOT/TAGNT.

Fonctions Strong pertinentes:

- Strong dictionaries.
- Strong concordance.
- `AugmentGrammar`: peut analyser Strong/morphologie/source indices et enrichir d'autres modules.
- `ReplaceStrongs`.
- Logos word numbers: peut utiliser `aligned-bible-corpus-data` et transferer des word numbers quand un module a Strong mais pas source locations.

Implication:

- Tres utile pour export/import et normalisation.
- Si notre produit doit sortir en formats lecteurs, ce repo evite de reimplementer beaucoup de conversions fragiles.

### IanLindsley/ptxprint-mcp

Lien: https://github.com/IanLindsley/ptxprint-mcp

Description: MCP server pour piloter PTXprint headlessly et produire des PDFs depuis des projets Paratext.

Pertinence:

- Pas un projet Strong.
- Adjacent publication/typesetting.
- Montre une integration agentique d'un outil biblique existant via MCP.

Implication:

- Utile plus tard si une Bible taggee doit etre publiee/composee depuis USFM/Paratext.

## Autres projets vus

### IanLindsley/node-twl-generator

Lien: https://github.com/IanLindsley/node-twl-generator

Description: librairie Node.js pour generer des TWLs.

Pertinence:

- Adjacent aux Translation Words et liens entre texte et lexique.
- Pas directement Strong/LLM.

### Clear-Bible/speaker-quotations

Lien: https://github.com/Clear-Bible/speaker-quotations

Pertinence:

- Donnees sur les mots originaux traduits comme citations et association avec speakers.
- Pas directement Strong generation, mais illustre le type d'annotation source-aware possible.

### Clear-Bible/Open-Bible-TSVs

Lien: https://github.com/Clear-Bible/Open-Bible-TSVs

Pertinence:

- Repository de TSV bibliques publics / Creative Commons.
- Potentiellement utile comme corpus cible ou format d'echange.

## Recherche academique proche

### Automated annotation of parallel Bible corpora

Lien: https://www.cambridge.org/core/journals/natural-language-engineering/article/automated-annotation-of-parallel-bible-corpora-with-crosslingual-semantic-concordance/1A24F5D79A85ACDE4989B61A7AB9D5D0

Pertinence:

- Travail academique proche de l'annotation automatique de corpus bibliques paralleles avec Strong/cross-lingual semantic concordance.
- Pas LLM-first.
- L'approche utilise des textes deja annotes, dictionnaires, SWORD API, alignement et evaluation.

Conclusion utile:

- Bon comme baseline pour traductions assez litterales.
- Necessite curation experte.
- Moins fiable sur les traductions dynamiques/paraphrasees.

### gold-standard-parallel-bible

Lien: https://github.com/jd-s/gold-standard-parallel-bible

Pertinence:

- Petit gold standard pour evaluer l'annotation de traductions allemandes/anglaises NT avec Strong.

Implication:

- Confirme l'importance de mesurer precision/rappel, pas seulement produire des tags.

## Analyse pour notre pipeline

### Ce que les precedents confirment

1. Le probleme a deja ete tente.
   - `farsi-strongs` prouve qu'une Bible cible taggee Strong automatiquement existe publiquement.
   - Le fil Logos prouve que des utilisateurs ont tente ChatGPT pour assigner des Strong.

2. Le LLM seul n'est pas fiable.
   - Les retours Logos signalent hallucinations et sur-assignation.
   - `bp-assistant-skills` documente explicitement que l'IA est mauvaise sur les taches deterministes, et que les scripts doivent gerer ces parties.

3. La bonne architecture est hybride.
   - Code pour parsing, matching, validation, export, scoring.
   - LLM pour decisions semantiques ou cas ambigus.

4. Les donnees sources existent.
   - Macula Hebrew/Greek, STEPBible, aligned-bible-corpus-data, Clear-Bible Alignments, wordMAP.
   - Le probleme n'est pas l'absence de donnees, mais la decision de placement lisible dans la Bible cible.

5. L'evaluation est centrale.
   - Clear-Bible/biblealignlib et l'article academique utilisent scoring/gold standards.
   - Notre evaluation masked-gold contre `Sg1910`, `Darby`, `DarbyR` est donc dans la bonne direction.

### Positionnement recommande pour ce projet

Ne pas viser "tous les mots originaux visibles dans la Bible francaise".

Viser plutot:

- une Bible Strong lisible, proche du style lecteur des references francaises;
- des Strong places sur les meilleurs porteurs semantiques francais;
- des tags vides seulement quand le Strong est legitime mais sans porteur fiable;
- des phrases multi-mots quand un concept source est rendu par une expression francaise;
- un score masked-gold pour verifier la qualite;
- un LLM utilise pour combler les trous semantiques, pas pour remplacer les alignements deterministes.

### Architecture cible inspiree des recherches

1. Generation deterministe baseline:
   - references francaises Strong (`Sg1910`, `Darby`, `DarbyR`);
   - profils par type de Bible;
   - placement word/phrase/empty;
   - confidence.

2. Validation source-aware:
   - Macula / STEPBible / original alignment seulement comme garde-fou;
   - pas comme moteur principal de placement visible.

3. Semantic refill LLM:
   - prompt contraint par verset, references, strong candidates, bible cible;
   - sortie JSON stricte;
   - interdiction de creer des Strong hors candidats;
   - validation mecanique apres coup.

4. Evaluation:
   - masked-gold sur Bibles Strong existantes;
   - precision, recall, F1;
   - taux de tags vides;
   - diagnostics par livre/testament/profil.

5. Export:
   - TSV/ledger JSON pour viewer;
   - plus tard USFM/USX/OSIS/SWORD via BibleMultiConverter ou scripts dedies.

## Liens rapides

- Direct precedent: https://github.com/scruffian/farsi-strongs
- LLM pipeline proche: https://github.com/unfoldingWord/bp-assistant-skills
- ChatGPT/Strong discussion: https://community.logos.com/forums/topic/224945-can-logos-add-strongs-numbers-to-a-translation/
- Word alignment: https://github.com/unfoldingWord/wordMAP
- Bible format converter: https://github.com/schierlm/BibleMultiConverter
- Edition mapping: https://github.com/schierlm/aligned-bible-corpus-data
- Macula Hebrew: https://github.com/Clear-Bible/macula-hebrew
- Macula Greek: https://github.com/Clear-Bible/macula-greek
- Clear-Bible Alignments: https://github.com/Clear-Bible/Alignments
- biblealignlib: https://github.com/Clear-Bible/biblealignlib
- STEPBible Data: https://github.com/STEPBible/STEPBible-Data
- Translation Helps MCP: https://github.com/klappy/translation-helps-mcp
- PTXprint MCP: https://github.com/IanLindsley/ptxprint-mcp
- Academic article: https://www.cambridge.org/core/journals/natural-language-engineering/article/automated-annotation-of-parallel-bible-corpora-with-crosslingual-semantic-concordance/1A24F5D79A85ACDE4989B61A7AB9D5D0
- Gold standard repo: https://github.com/jd-s/gold-standard-parallel-bible
