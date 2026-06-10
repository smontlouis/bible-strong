# Tagging Strong automatique pour n'importe quelle Bible

> Recherche & architecture de pipeline — Juin 2026
> Objectif : générer automatiquement une version « Strong » (type LSGS/KJVS) pour n'importe quelle traduction biblique, via alignement mot-à-mot avec les textes originaux.

---

## 1. État des lieux : ce qui existe déjà

### 1.1 L'écosystème SIL — le plus proche du besoin

- **[sillsdev/silnlp](https://github.com/sillsdev/silnlp)** : pipelines NLP (traduction neuronale, traduction statistique, **alignement mot-à-mot**) orientés langues à faibles ressources. SIL est l'organisation derrière Paratext, l'outil de référence des traducteurs bibliques.
- SIL a eu exactement cette réflexion : un projet ([issue #78](https://github.com/sillsdev/silnlp/issues/78)) visant à rendre disponibles des centaines/milliers de traductions bibliques avec **alignements automatiques sur le grec et l'hébreu**.
- **[sillsdev/machine](https://github.com/sillsdev/machine)** et `machine.py` : bibliothèque exposant les aligneurs (eflomal, fast_align, modèles IBM) via une API Python propre.

### 1.2 Clear.Bible — les données d'alignement de référence

- **[Clear-Bible/Alignments](https://github.com/Clear-Bible/Alignments)** : alignements mot-à-mot sous licence ouverte (automatiques + corrigés manuellement).
- **[Clear-Bible/biblealignlib](https://github.com/Clear-Bible/biblealignlib)** : bibliothèque Python pour manipuler ces alignements.
- **[Clear-Bible/clear-aligner](https://github.com/Clear-Bible/clear-aligner)** : outil graphique de révision d'alignements.
- **[Clear-Bible/macula-greek](https://github.com/Clear-Bible/macula-greek)** et **[macula-hebrew](https://github.com/Clear-Bible/macula-hebrew)** : datasets ouverts et curatés du texte grec/hébreu, chaque token portant **lemma + Strong + morphologie** (+ arbres syntaxiques, glosses, rôles sémantiques). → **Source de vérité idéale côté langues originales.**
- Le moteur NLP de Clear aligne les traductions au grec/hébreu pour des milliers de langues, avec gestion des versifications divergentes.

### 1.3 Les aligneurs mot-à-mot

| Outil | Type | Points forts |
|---|---|---|
| **[SimAlign](https://github.com/cisnlp/simalign)** | Embeddings multilingues (mBERT/XLM-R), **zero-shot** | Aucun entraînement requis ; excellent pour le français (langue bien couverte) |
| **[eflomal](https://github.com/robertostling/eflomal)** | Statistique bayésien (MCMC) | Surpasse fast_align en qualité/vitesse ; très bon avec ~31 000 versets de corpus |
| **fast_align** | IBM Model 2 | Rapide, baseline solide |
| **awesome-align** | BERT fine-tuné sur alignement | Qualité supérieure si fine-tuning possible |

Validation académique du concept : il existe des travaux publiés sur l'**annotation automatique de corpus du NT avec concordance Strong translingue** via alignement de textes parallèles.

### 1.4 Données et corpus

- **[schierlm/aligned-bible-corpus-data](https://github.com/schierlm/aligned-bible-corpus-data)** : mappings entre éditions bibliques (TAGNT, SBL, NA28, Byz…) avec colonnes Strong, racines et lemmes. Précieux pour la **versification** et les correspondances inter-éditions.
- **[jcuenod/awesome-bible-data](https://github.com/jcuenod/awesome-bible-data)** et **[BibleNLP/awesome-bible-nlp](https://github.com/BibleNLP/awesome-bible-nlp)** : listes curatées (corpus parallèles, Zefania XML 140+ Bibles dont certaines taggées Strong, eBible.org, etc.).
- **[BibleNLP/ebible](https://github.com/BibleNLP/ebible)** : corpus parallèle curaté dérivé d'eBible.org (extraction via silnlp).
- **[eliranwong/OpenHebrewBible](https://github.com/eliranwong/OpenHebrewBible)** : mapping Strong sur la BHS (AT hébreu).

### 1.5 Côté francophone

- **LSGS** : Segond 1910 + codes Strong incorporés (AT → lexique hébreu, NT → lexique grec). Texte dans le domaine public.
- Discussion active (nov. 2024) sur la mailing-list **CrossWire** pour maintenir un module Segond 1910 + Strong, avec versification alignée sur le WLC hébreu.
- **[smontlouis/bible-strong](https://github.com/smontlouis/bible-strong)** (GPL v3) : app francophone avec interlinéaire et numéros Strong — référence de format de données.

### 1.6 Conclusion de la recherche

**Toutes les briques existent, mais le produit final n'existe pas.** Aucun outil open source packagé ne prend une Bible française quelconque en entrée et ressort une version Strong-taggée. SIL fait de l'alignement de masse sans publier de générateur de Strong ; Clear publie les données surtout pour l'anglais. → **Créneau réel pour un outil open source, particulièrement pour le français.**

---

## 2. Architecture de pipeline proposée

### Principe clé

> **Ne pas aligner la traduction française sur la LSGS, mais directement sur le grec/l'hébreu.**
> La LSGS sert de *gold standard* d'évaluation, pas de source. On évite ainsi de cumuler deux couches d'erreurs d'alignement.

### Étape 1 — Préparer les pivots (textes originaux taggés)

- **NT** : Macula Greek (Nestle 1904 / SBLGNT) — chaque token : Strong + morphologie + lemma.
- **AT** : Macula Hebrew (WLC) ou OpenHebrewBible.
- ⚠️ **Choisir le bon texte grec source** selon la base textuelle de la cible : Texte Reçu pour les Segond-like, Nestle-Aland pour les traductions modernes. Sinon : mots fantômes (ex. 1 Jean 5:7).

### Étape 2 — Normaliser la versification

Piège n°1 : Psaumes hébreux (titres), Malachie 3/4, Joël 2/3, Romains 16…
→ Utiliser les mappings de `schierlm/aligned-bible-corpus-data` et les tables de versification SIL/Paratext.

### Étape 3 — Aligner (pipeline à deux étages)

1. **SimAlign** (LaBSE ou XLM-R de préférence à mBERT), verset par verset, grec/hébreu ↔ français. Zero-shot, fonctionne immédiatement.
2. **eflomal** entraîné sur le corpus complet (~31 000 paires de versets — largement suffisant pour un modèle statistique).
3. **Fusion** : intersection des deux = haute confiance ; union arbitrée = couverture maximale.

### Étape 4 — Propager les numéros Strong

Pour chaque mot français aligné à un token original : hériter du Strong.

Cas à gérer :
- **1 mot FR ↔ n tokens originaux** : concaténer les Strong (comme la LSGS avec ses codes multiples).
- **Mots-outils FR non alignés** (articles, prépositions) : laisser vides — c'est normal et conforme à la LSGS.
- **Codes morphologiques verbaux** (les 57xx de la LSGS) : dérivés directement du parsing Macula.

### Étape 5 — Évaluer contre la LSGS (avantage décisif)

1. Faire tourner le pipeline sur la **LSG 1910** elle-même.
2. Comparer la sortie aux tags **LSGS** existants.
3. Obtenir précision/rappel réels **par livre et par catégorie grammaticale**.

Attendu : >95 % sur substantifs/verbes ; zones faibles à identifier (particules, idiomes) pour cibler la révision.

### Étape 6 — Passe LLM pour les cas ambigus

Pour les versets où SimAlign et eflomal divergent :
- Prompt = verset original taggé + verset français + les deux hypothèses d'alignement.
- Le LLM (Claude/Gemini) tranche — tâche idéale pour un LLM, volume résiduel faible (quelques % du corpus) → coût maîtrisé.

---

## 3. Points de vigilance pour BibelStrong

### Licences des textes cibles

| Statut | Versions |
|---|---|
| ✅ Libres (domaine public) | LSG 1910, Ostervald, Martin, Darby, Crampon |
| ⚠️ Sous copyright — accord requis | S21 (© Société Biblique de Genève), NBS / autres (© Alliance biblique) |

> Tagger un texte crée une **œuvre dérivée** : distribuer une version Strong d'une traduction sous copyright nécessite l'accord de l'éditeur.

### Transparence du tagging automatique

- Afficher clairement dans l'app que le tagging est **généré automatiquement** (avec score de confiance éventuel).
- Prévoir un **mécanisme de signalement communautaire** des erreurs → boucle d'amélioration continue.

---

## 4. Prochaine étape suggérée

**Prototype** : script Python SimAlign + propagation Strong sur un livre test (ex. évangile de Marc), évalué contre la LSGS, pour mesurer concrètement la qualité avant d'industrialiser.
