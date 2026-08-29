export type MorphologyLanguage =
  | "greek"
  | "hebrew"
  | "aramaic"
  | "name"
  | "unknown";

export interface LexicalMorphologySupplement {
  code: string;
  normalizedCode: string;
  language: MorphologyLanguage;
  scope: "lexical_brief";
  example: string;
  meaning: string;
  description: string;
  meaningFr: string;
  descriptionFr: string;
  exampleFr: string;
  source: string;
}

const SOURCE = "STEP-lexical-morphology-supplement@1";

function supplement(
  code: string,
  language: MorphologyLanguage,
  meaning: string,
  meaningFr: string,
  description: string,
  descriptionFr: string
): LexicalMorphologySupplement {
  return {
    code,
    normalizedCode: normalizeMorphologyCode(code),
    language,
    scope: "lexical_brief",
    example: `Lexical code: ${code}.`,
    meaning,
    description,
    meaningFr,
    descriptionFr,
    exampleFr: `Code lexical : ${code}.`,
    source: SOURCE
  };
}

/**
 * Codes found in STEP TBESG/TBESH entries but omitted from the brief TEGMC/
 * TEHMC code lists. Meanings follow the notation documented in the STEP file
 * headers (Language:Type-Gender-Extra); composite and incomplete values are
 * deliberately described without inferring information STEP does not provide.
 */
export const LEXICAL_MORPHOLOGY_SUPPLEMENTS: readonly LexicalMorphologySupplement[] = [
  supplement("A:A", "aramaic", "Aramaic Adjective", "adjectif araméen", "An adjective in Aramaic.", "Adjectif en araméen."),
  supplement("A:Adv", "aramaic", "Aramaic Adverb", "adverbe araméen", "An adverb in Aramaic.", "Adverbe en araméen."),
  supplement("A:Cond", "aramaic", "Aramaic Conditional", "conditionnel araméen", "A conditional word or particle in Aramaic.", "Mot ou particule conditionnelle en araméen."),
  supplement("A:Conj", "aramaic", "Aramaic Conjunction", "conjonction araméenne", "A conjunction in Aramaic.", "Conjonction en araméen."),
  supplement("A:DemP", "aramaic", "Aramaic Demonstrative Pronoun", "pronom démonstratif araméen", "A demonstrative pronoun in Aramaic.", "Pronom démonstratif en araméen."),
  supplement("A:Intg", "aramaic", "Aramaic Interrogative", "interrogatif araméen", "An interrogative form in Aramaic.", "Forme interrogative en araméen."),
  supplement("A:Intj", "aramaic", "Aramaic Interjection", "interjection araméenne", "An interjection in Aramaic.", "Interjection en araméen."),
  supplement("A:N--T", "aramaic", "Aramaic Noun — Title or other capitalized noun", "nom araméen — titre ou autre nom à majuscule", "An Aramaic noun classified by STEP as a title or another capitalized noun that is neither a person nor a place.", "Nom araméen classé par STEP comme titre ou autre nom à majuscule qui ne désigne ni une personne ni un lieu."),
  supplement("A:N-F", "aramaic", "Aramaic Noun (Feminine)", "nom araméen (féminin)", "A feminine noun in Aramaic.", "Nom féminin en araméen."),
  supplement("A:N-M", "aramaic", "Aramaic Noun (Masculine)", "nom araméen (masculin)", "A masculine noun in Aramaic.", "Nom masculin en araméen."),
  supplement("A:Neg", "aramaic", "Aramaic Negative", "négation araméenne", "A negative word or particle in Aramaic.", "Mot ou particule de négation en araméen."),
  supplement("A:Part", "aramaic", "Aramaic Particle", "particule araméenne", "A particle in Aramaic.", "Particule en araméen."),
  supplement("A:PerP-CP", "aramaic", "Aramaic Personal Pronoun (Common Plural)", "pronom personnel araméen (genre commun, pluriel)", "An Aramaic personal pronoun of common gender in the plural.", "Pronom personnel araméen de genre commun au pluriel."),
  supplement("A:PerP-CS", "aramaic", "Aramaic Personal Pronoun (Common Singular)", "pronom personnel araméen (genre commun, singulier)", "An Aramaic personal pronoun of common gender in the singular.", "Pronom personnel araméen de genre commun au singulier."),
  supplement("A:PerP-MP", "aramaic", "Aramaic Personal Pronoun (Masculine Plural)", "pronom personnel araméen (masculin pluriel)", "A masculine plural personal pronoun in Aramaic.", "Pronom personnel masculin pluriel en araméen."),
  supplement("A:PerP-MS", "aramaic", "Aramaic Personal Pronoun (Masculine Singular)", "pronom personnel araméen (masculin singulier)", "A masculine singular personal pronoun in Aramaic.", "Pronom personnel masculin singulier en araméen."),
  supplement("A:Prep", "aramaic", "Aramaic Preposition", "préposition araméenne", "A preposition in Aramaic.", "Préposition en araméen."),
  supplement("G:", "greek", "Greek morphology unspecified", "morphologie grecque non précisée", "STEP identifies the language as Greek but supplies no grammatical category.", "STEP indique que la langue est le grec, sans préciser la catégorie grammaticale."),
  supplement("G:A-M", "greek", "Greek Adjective (Masculine)", "adjectif grec (masculin)", "A masculine adjective in Greek.", "Adjectif masculin en grec."),
  supplement("G:C-", "greek", "Greek Reciprocal Pronoun", "pronom réciproque grec", "A reciprocal pronoun in Greek; the trailing separator carries no additional value.", "Pronom réciproque en grec ; le séparateur final n'apporte aucune valeur supplémentaire."),
  supplement("G:CONJ+G:P-1", "greek", "Greek Conjunction joined to Greek Personal Pronoun (1st person)", "conjonction grecque jointe à un pronom personnel grec (1re personne)", "A compound form joining a Greek conjunction to a first-person personal pronoun.", "Forme composée joignant une conjonction grecque à un pronom personnel de première personne."),
  supplement("G:N-F / G:A-F", "greek", "Greek Noun (Feminine) OR Greek Adjective (Feminine)", "nom grec (féminin) OU adjectif grec (féminin)", "STEP allows either a feminine Greek noun or a feminine Greek adjective for this entry.", "STEP indique pour cette entrée soit un nom grec féminin, soit un adjectif grec féminin."),
  supplement("G:N-F / G:V", "greek", "Greek Noun (Feminine) OR Greek Verb", "nom grec (féminin) OU verbe grec", "STEP allows either a feminine Greek noun or a Greek verb for this entry.", "STEP indique pour cette entrée soit un nom grec féminin, soit un verbe grec."),
  supplement("Prefix", "unknown", "Prefix segment", "segment préfixe", "A segment identified by STEP as a prefix rather than a complete lexical word.", "Segment identifié par STEP comme un préfixe plutôt que comme un mot lexical complet."),
  supplement("Punct.", "unknown", "Punctuation segment", "segment de ponctuation", "A punctuation segment in the STEP lexical data.", "Segment de ponctuation dans les données lexicales STEP."),
  supplement("Suffix", "unknown", "Suffix segment", "segment suffixe", "A segment identified by STEP as a suffix rather than a complete lexical word.", "Segment identifié par STEP comme un suffixe plutôt que comme un mot lexical complet.")
];

export function normalizeMorphologyCode(code: string): string {
  return code
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s+/g, " ")
    .trim();
}
