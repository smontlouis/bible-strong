import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { DEFAULT_RESOURCE_LANGUAGE } from '@/features/resources/publicSite'
import { parseStrongCode, strongCodeSlug } from '@/features/strong/strongRoutes'

// The study workspace route has no language (ADR-0053); here it resolves to the default one.
export const Route = createFileRoute('/strong/$code')({
  beforeLoad: ({ params }) => {
    const identity = parseStrongCode(params.code)
    if (!identity) throw notFound()
    throw redirect({
      to: '/strong/$language/$code',
      params: { language: DEFAULT_RESOURCE_LANGUAGE, code: strongCodeSlug(identity.code) },
      statusCode: 301,
    })
  },
})
