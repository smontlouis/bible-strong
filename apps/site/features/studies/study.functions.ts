import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getStudy } from './helpers.study'

export const loadStudy = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const study = await getStudy(data.id)
    if (!study) throw notFound()
    return study
  })
