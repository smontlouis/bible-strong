import { Study } from './types'

interface Props {
  tags: Study['tags']
  limit?: number
}
const TagList = ({ tags, limit = 5 }: Props) => {
  if (!tags || !Object.values(tags).length) {
    return null
  }

  const array = limit
    ? Object.values(tags).slice(0, limit)
    : Object.values(tags)

  return (
    <div className="mt-4 flex flex-wrap items-center">
      {array.map((tag) => (
        <span
          key={tag.id}
          className="mb-2 mr-2 rounded-full bg-accent px-3 py-1 text-sm text-primary"
        >
          {tag.name}
        </span>
      ))}
      {!!(Object.values(tags).length - limit > 0) && (
        <span className="ml-2 text-sm text-primary">
          + {Object.values(tags).length - limit}
        </span>
      )}
    </div>
  )
}

export default TagList
