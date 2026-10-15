/**
 * What the original-language Bible is, whatever revision is published. The published revision,
 * its archives and the text each index was built for are read from the Artifact catalog.
 *
 * Kept apart from the catalog so that a reader of the identity alone, such as the public site,
 * does not bundle the catalog: its build, and the pages kept under it, would then change with
 * every publication (ADR-0084).
 */
export const BHG_INTERLINEAR_IDENTITY = {
  applicationVersionId: 'BHG',
  datasetId: 'STEP',
  sourceVersion: 'TAHOT/TAGNT',
  attribution: 'Données créées par STEPBible.org à partir des travaux de Tyndale House Cambridge',
  license: 'CC BY 4.0',
  sourceUrl: 'https://github.com/STEPBible/STEPBible-Data',
} as const
