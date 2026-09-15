# Corrections issues de l'audit du 15 septembre 2026

Autorisation : demande « fix » après le rapport d'audit UI/UX/fonctionnel.

- 114 poèmes La Bonne Semence corrigés dans 54 sections mensuelles.
- Les 2 191 HTML sources ont été comparés aux SHA256 de l'import initial, avant extraction.
- L'ordre et l'intégralité des caractères hors espaces sont identiques avant/après : seules les séparations de vers/strophes sont restaurées.
- Six éditions La Bonne Semence utilisent une couverture originale neutre sans date.
- Douze éditions des parcours Bible Strong reçoivent une couverture simplifiée lisible en vignette.

`poems.json` conserve le texte avant/après ; `patches.json` fixe les champs autorisés ;
`before.json` sauvegarde les documents distants avant écriture ; `receipt.json` atteste
l'application atomique des 72 mises à jour. L'import original reste traçable par ses reçus.
Les manifests `documents.json` reflètent désormais les corrections et les métadonnées publiées.

Publication : `python3 scripts/publish-reading-ui-fixes.py preflight|publish|verify`.
Chaque écriture utilise un masque de champs et la précondition `updateTime` du document
inspecté. Aucun plan ni suivi utilisateur n'est créé, supprimé ou réinitialisé. Les identités
supprimées depuis l'import sont ignorées, jamais recréées. Ne pas relancer `publish` après
succès ; utiliser `verify`.

La couverture neutre a ensuite été ajustée pour que son titre reste dans la zone sûre du
recadrage carré et portrait. `receipt-initial.json` conserve la première publication ;
`receipt.json` décrit l'état final et son `coverAdjustmentCommitTime` (six couvertures).
