# Charte expérimentale de revue sémantique Strong

Cette charte définit une référence distincte des balises CSV historiques. Elle
ne modifie ni le texte canonique ni les règles de publication. Le paquet de
60 passages est **non annoté** : un format valide ou un accord entre modèles
ne lui confère pas le statut de référence validée.

## Trois décisions séparées

1. **Relation de traduction.** Quelle occurrence source est représentée, et par
   quels tokens français ? Utiliser les identifiants d’occurrence, jamais le
   numéro Strong seul. Décrire une relation lexicale, grammaticale ou idiomatique.
2. **Groupe acceptable.** Conserver les ensembles de tokens source et français,
   y compris les groupes discontinus et les relations plusieurs-à-plusieurs.
   Un groupe n’implique pas que chacun de ses mots traduise chacun des mots source.
3. **Support du numéro.** Décrire séparément les supports visuels acceptables
   pour chaque occurrence. Un support doit appartenir au groupe français ; son
   choix ne redéfinit pas le sens de la relation.

Exemples pédagogiques, sans valeur d’annotation du benchmark : une expression
comme « jeunes gens » peut traduire une seule unité lexicale source. Sa relation
avec le groupe peut être certaine alors que le choix de « jeunes », « gens » ou
du groupe complet comme support dépend d’une convention éditoriale. Pour « les
barres », retirer l’article peut améliorer la conformité à une convention de
support sans corriger une erreur de traduction. À l’inverse, deux groupes
proches dans un verset peuvent traduire deux occurrences différentes : leur
ressemblance ne permet pas de les échanger.

## Certitude et absence

- `sure` : relation nécessaire selon la lecture retenue et les sources citées.
- `possible` : relation acceptable, notamment comme alternative explicitement
  motivée. Ne pas transformer un simple voisinage lexical en équivalence.
- `absent` : occurrence identifiée sans équivalent français explicite ; motiver
  cette conclusion. Distinguer l'absence d'un porteur lexical distinct de la
  disparition du rôle grammatical : un vide lexical peut coexister avec une
  relation grammaticale documentée. Le rôle grammatical seul ne prouve pas
  l'absence ; la règle appliquée et la construction cible doivent être explicites.
- `uncertain` : décision non résolue. Ni l’absence de balise CSV, ni un lien NULL
  d’un aligneur, ni l’échec à trouver un candidat ne prouvent `absent`.

Consigner les différences d’édition source, la versification, les notes entrées
dans le texte et les problèmes de tokenisation dans `problems`. Une édition
source incompatible doit être résolue ou exclue avant le calcul d’une mesure
sémantique. Ne pas corriger silencieusement les offsets pendant une revue.

## Procédure

- Présenter le français et les occurrences source, avec gloses et morphologie.
  Masquer les prédictions, les balises attendues et les placements actuels.
- Faire deux annotations séparées. Chaque annotateur conserve son identité,
  les références effectivement consultées et ses justifications. Deux appels
  d’un même modèle ne constituent pas deux expertises humaines indépendantes.
- Comparer ensuite les annotations et adjudicer les désaccords. Conserver les
  deux originaux et une troisième version adjudicée avec provenance.
- Ne pas modifier cette référence après avoir vu une prédiction sans versionner
  le changement et en donner la raison. Les 100 passages de réserve demeurent
  disponibles pour un test ultérieur, après gel de la méthode.

Le paquet fourni est la première entrée de ce processus. Aucune indépendance
éditoriale, validation humaine ou adjudication n’est prétendue à ce stade.

## Format de travail

Le script `prepare-review.ts` copie le paquet initial, avec son empreinte, vers
un nouveau fichier `semantic-review.json`. Il ne lit aucune prédiction ni balise
CSV. Chaque passage conserve les tokens indexés et les identifiants source.

La version 2 ajoute `physicalSourceGroups` : un même token STEP peut porter
plusieurs identités Strong alternatives. Ces identités ne représentent pas
automatiquement plusieurs mots source à traduire séparément. Revoir d’abord
l’occurrence physique et sa relation, puis la compatibilité des identifiants
avec l’édition cible. Ne pas exiger un placement supplémentaire pour chaque alias.

```json
{
  "status": "in-progress",
  "reviewer": "identifiant de l’annotateur",
  "sourcesConsulted": [],
  "groups": [
    {
      "id": "g1",
      "sourceOccurrenceIds": ["identifiant-source-existant"],
      "targetWordIndices": [7, 9],
      "certainty": "possible",
      "relation": "idiomatic",
      "carrierOptions": [],
      "rationale": "Justification du groupe discontinu et de l’incertitude."
    }
  ],
  "absent": [],
  "uncertain": [],
  "problems": []
}
```

Une option de support a la forme `{ "occurrenceId": "…", "tokenIndices": [7] }`.
Les listes de tokens sont des ensembles explicites, pas des intervalles dont les
mots intermédiaires seraient implicitement inclus. Les listes `absent` et
`uncertain` contiennent `{ "occurrenceId": "…", "rationale": "…" }`.
Les problèmes contiennent `{ "kind": "text-contamination", "detail": "…" }`.
Le validateur refuse les identifiants inconnus, les supports hors groupe et les
contradictions entre lien, absence et incertitude ; une revue déclarée complète
doit statuer sur chaque occurrence source.

## Mesures à produire après adjudication

Conserver séparément la conformité exacte aux CSV, le rappel des relations
certaines, la précision vis-à-vis des relations acceptables, les erreurs
d’identité d’occurrence et l’acceptabilité des supports visuels. Mesurer aussi
les omissions, abstentions et désaccords entre annotateurs.

Ne pas élargir automatiquement une référence par proximité de mots pour faire
monter les scores. Ne pas convertir un groupe plusieurs-à-plusieurs en produit
cartésien de liens mot-à-mot. La métrique sémantique finale sera définie et gelée
sur la structure réellement annotée, avant d’évaluer les passages réservés.

Cette séparation s’inspire du [modèle de groupes de Clear Bible](https://github.com/Clear-Bible/biblealignlib/blob/main/docs/explanation/alignment-model.md)
et des [liens certains/possibles de SimAlign](https://github.com/cisnlp/simalign),
étudiés dans la [recherche préalable](./strong-alignment-research-sources-2026-10-01.md).
