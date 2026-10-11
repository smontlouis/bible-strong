import { createFileRoute } from '@tanstack/react-router'
import { appLinkResponse, appleAppSiteAssociation } from '@/features/appLinks/appLinks'

// What iOS reads to open a link to this site in the application (ADR-0082).
export const Route = createFileRoute('/.well-known/apple-app-site-association')({
  server: {
    handlers: {
      GET: () => appLinkResponse(appleAppSiteAssociation),
    },
  },
})
