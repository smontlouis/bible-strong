import { createFileRoute } from '@tanstack/react-router'
import { loadStudy } from '@/features/studies/study.functions'
import Study from '@/pages/studies/[id]'

export const Route = createFileRoute('/fr/studies/$id')({
  loader: ({ params }) => loadStudy({ data: { id: params.id } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [
    { title: `${loaderData.title} - Bible Strong App` },
    { name: 'description', content: `${loaderData.title} - Bible Strong App. Cette étude a été rédigée par ${loaderData.user.displayName}` },
    { property: 'og:title', content: loaderData.title },
    { property: 'og:type', content: 'website' },
    { property: 'og:updated_time', content: loaderData.modified_at.toString() },
    { property: 'og:image', content: loaderData.imageUrl },
  ] : [] }),
  component: StudyRoute,
})
function StudyRoute() { return <Study data={Route.useLoaderData()} /> }
