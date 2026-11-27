# Plan ASO — App Store et Google Play (audit du 27 novembre 2026)

Textes proposés pour l'étape 1 : `docs/store/fiches-stores.md`.

## Étape 1 — Textes et technique (pas de design)

État au 27 novembre 2026 : étapes 1 et 2 faites (iOS en brouillon dans la 28.3.2, Play publié sauf les captures desktop). Détail dans `docs/store/fiches-stores.md`.

- [x] 1. Réécrire nom, sous-titre et mots-clés iOS en français et en anglais, en visant « étude biblique », « concordance », « hébreu grec », « Louis Segond », « bible audio », « assistant IA ». Exemples :
  - Nom : « Bible Strong : Étude biblique »
  - Sous-titre : « Hébreu, grec, audio et IA »
- [x] 2. Réécrire les descriptions. Sur Play, c'est prioritaire pour la recherche : les termes clés y reviennent naturellement.
- [x] 3. Remplir le texte promotionnel iOS, corriger l'URL de support, ajouter une URL marketing et une catégorie secondaire.
- [ ] 4. Play : lancer la fiche personnalisée « bible » que propose la Console et une première expérience A/B.
- [ ] 5. Corriger l'ANR Android et le taux de crash iOS. C'est un chantier technique à part.

## Étape 2 — Nouveau jeu de visuels (un design de base, décliné par format)

- [x] 10 écrans qui racontent une histoire (l'ordre final diffère un peu : voir `fiches-stores.md`). Les 3 premiers comptent le plus, car ce sont eux qui apparaissent dans les résultats de recherche :
  1. Accroche principale
  2. Strobi
  3. Strong et hébreu-grec
  4. Lecture parallèle et onglets
  5. Audio et Trésor sonore
  6. Ressources : dictionnaires, commentaires, Nave
  7. Frise illustrée
  8. Études et notes
  9. Méditations et plans de lecture
  10. Hors ligne, synchronisation, gratuit et open source
- [x] Formats : iPhone 1206×2622, iPad 2064×2752, Play téléphone 1440×2560, tablettes, Chromebook (desktop), feature graphic 1024×500. Pliable non fait.
- [x] Illustrations : remplacer la photo de stock et les emoji 3D par le style maison (illustrations et peintures de la frise), avec les tokens du design system.
- [x] En-tête et visuel de recherche iOS 27 : un grand visuel illustré, avec le contenu important dans la zone de sécurité.

## Étape 3 — Vidéo

- [ ] Une vidéo d'aperçu iPhone de 15 à 30 s, qui fonctionne sans le son.
- [ ] La même, reprise en vidéo YouTube Play et en boucle pour l'en-tête. (En attendant, la fiche Play utilise le teaser pitch sur YouTube.)
- Le pipeline HyperFrames et `videos/bible-strong-feature-series` peuvent servir de base.

## Étape 4 — En continu

- [ ] Événements in-app et contenus promotionnels Play : « Lire la Bible en 2027 » en janvier, Avent, Pâques.
- [ ] 3 ou 4 pages produit personnalisées, une par profil : hébreu-grec, assistant IA, audio, étude.
- [ ] Tests A/B des captures.
- [ ] Captures iPhone Duo avant avril 2027.

## Échéances

- 15 janvier 2027 : répondre aux nouvelles questions de classification par âge dans App Store Connect.
- Avril 2027 : captures iPhone Duo obligatoires pour les apps compilées avec le SDK iOS 27.1 ou plus récent.
