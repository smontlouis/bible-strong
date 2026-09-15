# Audit UX/UI — plans et méditations

14 septembre 2026. Périmètre : pages, navigation, widgets et états de présentation. Les modifications déjà présentes dans le worktree ont été conservées. Cet audit ne reprend pas les recherches éditoriales ni le diagnostic de livraison des notifications précédemment arrêtés.

## Principes conservés

- Un lecteur de méditation partagé ; anciens liens compatibles.
- Images en cover, couleurs et polices de l’application.
- Actions secondaires dans les menus, peu de texte explicatif.
- Plans repris au premier jour non terminé ; dates historiques non inventées.
- Barre de progression discrète et jour courant, sans pourcentage affiché.
- Bibliothèque française et anglaise ; catalogue complet même pour les plans déjà suivis.

## Pages et corrections

| Surface | Incohérence observée | Correction |
| --- | --- | --- |
| Catalogue `/plans` | Introduction volumineuse, cartes plus grandes que sur l’accueil, fond limité à une bande centrale | Introduction retirée, cartes et vignettes compactes, fond pleine largeur ; catalogue bilingue conservé |
| Carte de plan | Plan terminé proposant encore « Continuer », détail possible « Jour 1 sur 0 » pendant restauration | « Relire » pour un plan terminé et libellé de reprise neutre avant disponibilité du contenu |
| Ouverture depuis le catalogue | Téléchargement bloquant sur la carte avant navigation, pouvant naviguer tard après le départ de l’utilisateur | Navigation immédiate ; chargement et erreur gérés par la page cible existante |
| Page du plan | Dates tassées, « Aujourd’hui » coupé, hauteur différente sous les jours cochés | Colonnes élargies, nombre de jours adapté, labels courts ; numéro secondaire seulement en l’absence de date |
| Page du plan | Chaque passage avait un chevron mais ouvrait le même début de journée | Passages présentés comme contenu de la journée, action principale unique ; « Relire » pour une journée terminée |
| Page du plan vide | « Jour 1 sur 0 » et contrôles sans contenu | État indisponible concis sans navigation factice |
| Menu du plan | Réinitialiser/arrêter proposé sur un simple aperçu | Actions de cycle de vie réservées à une participation réelle |
| Lecteur `/plan-slice` | Long préambule animé, grand badge de fin, grands espacements hérités | Accès immédiat au contenu, badge discret, marges de lecture harmonisées |
| Lecteur vidéo | Erreur uniquement envoyée dans les logs, pouvant laisser une zone vide | Indicateur de chargement et action pour ouvrir la vidéo si le lecteur échoue |
| Bibliothèque `/daily-reading` | Auteur parfois identique au titre | Doublon supprimé ; structure récente en sections et sélection directe conservées |
| Recueil `/meditation-collection` | Bouton sélectionné trop estompé, sélection visuelle arbitraire du premier jour d’un autre mois, bouton Aujourd’hui revenant tout en haut | Bouton compact lisible, surlignage du vrai jour courant, défilement vers sa lecture |
| Lecteur `/meditation` | Position de défilement réutilisée après changement de lecture | Retour au début du nouveau texte ; état indisponible si la ressource est en réalité un plan |
| En-têtes | Largeur 830px alors que les contenus s’étendent à 940/1000/1180px | Largeur configurable, appliquée aux trois pages concernées uniquement |
| Calendrier | Datepicker web restant clair en thème sombre ; date native tronquée sur faible largeur | Palette sombre HeroUI, date native autorisée à se répartir sur plusieurs lignes |
| Rappels | Heure affichée deux fois sur iOS : texte cliquable plus contrôle natif | Un seul contrôle horaire iOS ; ouverture explicite conservée sur Android |
| Verset daté `/daily-verse` | Libellé de date vide au-delà des cinq derniers jours | Date civile explicite comme repli |

## Validation et limites

Inspection du code de toutes les surfaces listées et captures web du catalogue, du plan, du recueil, du lecteur de méditation, du lecteur de plan et de la bibliothèque. Aucun parcours Argent, aucune modification de préférences du compte pendant l’audit. Vérifications automatisées ciblées et export web consignés dans la réponse de livraison. Les comportements spécifiques aux contrôles système iOS/Android et la réception des notifications ne sont pas présentés comme validés visuellement par cet audit.

Résultats de cette passe : 116 tests ciblés passent (17 suites), TypeScript Expo et ESLint ciblé passent, export web réussi, garde de styles valide. Contrôles d’architecture et de qualité valides (456 avertissements d’architecture déjà suivis par le rapport global). Les captures d’accueil confirment aussi le maintien du widget et de son attribution compacte après chargement.
