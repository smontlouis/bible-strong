import {
  isBiblePublicationBundleManifest,
  isCommentaryPublicationBundleManifest,
  isCrossReferencePublicationBundleManifest,
  isDictionaryPublicationBundleManifest,
  isInterlinearBiblePublicationBundleManifest,
  isNavePublicationBundleManifest,
  isStrongLexiconPublicationBundleManifest,
  isTimelinePublicationBundleManifest,
  type PublicationBundleManifest,
} from './publicationBundle'

export const getPublicationResourceIdentity = (manifest: PublicationBundleManifest): string =>
  isBiblePublicationBundleManifest(manifest)
    ? `bible-text:${manifest.identity.versionId}`
    : isNavePublicationBundleManifest(manifest)
      ? `nave:${manifest.identity.language}`
      : isDictionaryPublicationBundleManifest(manifest)
        ? `dictionary:${manifest.identity.language}`
        : isCommentaryPublicationBundleManifest(manifest)
          ? `commentary:${manifest.identity.resourceId}:${manifest.identity.language}`
          : isCrossReferencePublicationBundleManifest(manifest)
            ? `cross-references:${manifest.identity.language}`
            : isTimelinePublicationBundleManifest(manifest)
              ? `timeline:${manifest.identity.language}`
              : isInterlinearBiblePublicationBundleManifest(manifest)
                ? `interlinear-index:${manifest.identity.versionId}:${manifest.identity.language}`
                : isStrongLexiconPublicationBundleManifest(manifest)
                  ? manifest.identity.resourceId
                  : `strong-bible-index:${manifest.identity.versionId}`

export const getMobileResourceCatalogId = (manifest: PublicationBundleManifest): string =>
  isBiblePublicationBundleManifest(manifest)
    ? `bible:${manifest.identity.versionId}`
    : isInterlinearBiblePublicationBundleManifest(manifest)
      ? `bible-interlinear:${manifest.identity.versionId}:${manifest.identity.language}`
      : manifest.identity.kind === 'strong-bible-index'
        ? `bible-strong:${manifest.identity.versionId}`
        : isStrongLexiconPublicationBundleManifest(manifest)
          ? manifest.identity.resourceId
          : isNavePublicationBundleManifest(manifest)
            ? `database:NAVE:${manifest.identity.language}`
            : `database:${manifest.identity.resourceId}:${manifest.identity.language}`
