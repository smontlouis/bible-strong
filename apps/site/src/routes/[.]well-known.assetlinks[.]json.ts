import { createFileRoute } from '@tanstack/react-router'
import { androidAssetLinks, appLinkResponse } from '@/features/appLinks/appLinks'

// What Android reads to open a link to this site in the application (ADR-0082).
export const Route = createFileRoute('/.well-known/assetlinks.json')({
  server: {
    handlers: {
      GET: () => appLinkResponse(androidAssetLinks),
    },
  },
})
