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

export const getPublicationIdentityProjection = (
  manifest: PublicationBundleManifest
): { resourceIdentity: string; mobileCatalogId: string } =>
  isBiblePublicationBundleManifest(manifest)
    ? {
        resourceIdentity: `bible-text:${manifest.identity.versionId}`,
        mobileCatalogId: `bible:${manifest.identity.versionId}`,
      }
    : isNavePublicationBundleManifest(manifest)
      ? {
          resourceIdentity: `nave:${manifest.identity.language}`,
          mobileCatalogId: `database:NAVE:${manifest.identity.language}`,
        }
      : isDictionaryPublicationBundleManifest(manifest)
        ? {
            resourceIdentity: `dictionary:${manifest.identity.language}`,
            mobileCatalogId: `database:${manifest.identity.resourceId}:${manifest.identity.language}`,
          }
        : isCommentaryPublicationBundleManifest(manifest)
          ? {
              resourceIdentity: `commentary:${manifest.identity.resourceId}:${manifest.identity.language}`,
              mobileCatalogId: `database:${manifest.identity.resourceId}:${manifest.identity.language}`,
            }
          : isCrossReferencePublicationBundleManifest(manifest)
            ? {
                resourceIdentity: `cross-references:${manifest.identity.language}`,
                mobileCatalogId: `database:${manifest.identity.resourceId}:${manifest.identity.language}`,
              }
            : isTimelinePublicationBundleManifest(manifest)
              ? {
                  resourceIdentity: `timeline:${manifest.identity.language}`,
                  mobileCatalogId: `database:${manifest.identity.resourceId}:${manifest.identity.language}`,
                }
              : isInterlinearBiblePublicationBundleManifest(manifest)
                ? {
                    resourceIdentity: `interlinear-index:${manifest.identity.versionId}:${manifest.identity.language}`,
                    mobileCatalogId: `bible-interlinear:${manifest.identity.versionId}:${manifest.identity.language}`,
                  }
                : isStrongLexiconPublicationBundleManifest(manifest)
                  ? {
                      resourceIdentity: manifest.identity.resourceId,
                      mobileCatalogId: manifest.identity.resourceId,
                    }
                  : {
                      resourceIdentity: `strong-bible-index:${manifest.identity.versionId}`,
                      mobileCatalogId: `bible-strong:${manifest.identity.versionId}`,
                    }
