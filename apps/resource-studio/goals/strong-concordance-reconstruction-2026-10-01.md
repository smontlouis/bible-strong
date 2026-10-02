# Goal : reconstruction masquée de S21 face à Concordance.bible

Ouvert le 1er octobre 2026 depuis le commit `dec602f8d`, sur la branche
d’expérience `claude/strong-s21-concordance-rebuild-e5fefb`. Protocole :
[prompt autonome](../docs/strong-concordance-night-experiment-prompt-2026-10-01.md),
après lecture du [checkpoint](../docs/strong-concordance-checkpoint-2026-10-01.md).

Le goal est atteint seulement lorsque tous les critères ci-dessous sont remplis.
Un rapport intermédiaire, un plan ou une page de revue ne suffisent pas.

## Critères de fin

1. **Contrôle externe figé.** Les pages SG21 (puis NEG si elles portent des
   Strong) d’un échantillon borné de chapitres sont acquises par une commande
   séparée, avec URL, date, statut HTTP, empreinte et procédure conservés.
   La présence réelle des annotations est vérifiée, page par page.
2. **Unités alignées.** Texte et versets Concordance comparés au texte local
   exact ; notes d’éditeur séparées ; chaque verset non comparable compté avec
   sa raison. Les positions source Concordance sont rapprochées des mots STEP.
3. **Aucune fuite.** Les annotations cibles ne sont lues que par l’évaluateur.
   Les prédictions sont scellées avant lecture des étiquettes ; un rejeu sans
   accès au cache cible produit des prédictions identiques. La provenance des
   dictionnaires est auditée et documentée.
4. **Référence initiale.** Prédictions du code initial sauvegardées avec leurs
   empreintes, pour deux scénarios : cible exclue (autres témoins disponibles)
   et famille Segond exclue. Proximité éditoriale LSG/S21/NEG documentée.
5. **Améliorations mesurées.** Désaccords de développement classés ; deux ou
   trois familles d’erreurs traitées ; moteur initial, chaque amélioration et
   leur combinaison comparés ; adaptation par édition comparée à la règle commune.
6. **Test réservé.** Règles gelées avant l’exécution du test ; rejeu déterministe
   vérifié ; contrôles LSG/Darby/DarbyR sans régression non expliquée.
7. **Livrables.** Outil rejouable, tests, code compilé, sorties complètes sous
   `outputs/strong-concordance-night/` (ignoré par Git) et rapport français
   synthétique dans le dépôt, sans texte biblique intégral ni secret.

## Hors périmètre

Aucune publication, activation, mise en production, poussée Git ni message à un
tiers. Aucun appel à un modèle distant. Pas de relance de la génération des neuf
Bibles. Laya local n’est retenu que si son apport est mesuré.

## État

**Atteint le 1er octobre 2026.** Rapport :
[strong-concordance-reconstruction-2026-10-01.md](../docs/strong-concordance-reconstruction-2026-10-01.md).

1. Contrôle externe figé : 102 pages publiques (SG21 et NEG, 48 chapitres chacune,
   plus 6 pages de provenance), reçus et sceau `acquisition-seal-v1.json`.
2. Unités alignées : 1 073 versets SG21 sur 1 075 identiques au texte local ;
   positions Concordance égales aux numéros de mots STEP ; cas non comparables
   comptés (1 SG21, 13 NEG, dont des défauts du texte local NEG79).
3. Aucune fuite : graphe d'import vérifié, prédictions scellées, rejeu sans accès
   au cache identique ; corrections éditoriales désactivées ; provenance des
   dictionnaires documentée.
4. Référence initiale scellée pour 14 exécutions ; deux scénarios ; proximité
   LSG/S21/NEG mesurée.
5. Quatre familles (A–D) mesurées seules et combinées sur le développement selon
   des critères enregistrés d'avance ; profils d'édition comparés au profil commun.
6. Politique ABCD figée avant l'ouverture du test ; test, rejeux déterministes,
   contrôles LSG/Darby/DarbyR et canaris historiques sans régression.
7. Outil, tests (18 nouveaux, aucun nouvel échec), code compilé (erreurs de build
   préexistantes inchangées), sorties sous `outputs/strong-concordance-night/`.

Non relancé, conformément au protocole : la génération des neuf Bibles.

Suite décidée ensuite (section 11 du rapport) : A–D actives par défaut, B
retouchée (identifiant des témoins d'abord) et vérifiée en addendum du réservé,
corrections S21 tirées de Concordance retirées, référence de l'audit NBS 10×5
mise à jour.

Étape 3 (2 octobre, section 12) : témoins repris des exports Concordance du
28 septembre, locution entière (E), positions source (F) et mots non traduits
établis par les témoins (G), mesurés sur le développement puis vérifiés une
dernière fois sur le réservé ; NEG79 et DBR préparés pour publication, rien de
publié.
