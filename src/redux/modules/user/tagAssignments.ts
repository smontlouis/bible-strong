import type { Tag } from '~common/types'
import type { ToggleTagEntityItem } from './tags'
import { entitiesArray } from './tags'

type EntityTagRef = {
  id: string
  name: string
}

type EntityWithTags = {
  id?: string
  title?: string
  color?: string
  tags?: Record<string, EntityTagRef>
  [key: string]: unknown
}

export type BibleEntityCollection = Record<string, EntityWithTags>

export type TaggableEntity = (typeof entitiesArray)[number]

export type BibleTagAssignmentsState = {
  tags: Record<string, Tag>
  [key: string]: unknown
}

const isEphemeralTagOnlyEntity = (entity: TaggableEntity) =>
  entity === 'naves' || entity === 'strongsHebreu' || entity === 'strongsGrec' || entity === 'words'

const getEntityCollection = (
  bible: BibleTagAssignmentsState,
  entity: TaggableEntity
): BibleEntityCollection => {
  if (!bible[entity]) {
    bible[entity] = {}
  }

  return bible[entity] as BibleEntityCollection
}

const ensureTagEntityIndex = (
  bible: BibleTagAssignmentsState,
  tagId: string,
  entity: TaggableEntity
) => {
  if (!bible.tags[tagId][entity]) {
    bible.tags[tagId][entity] = {}
  }

  return bible.tags[tagId][entity]!
}

const shouldDeleteEmptyHighlight = (entity: TaggableEntity, value: EntityWithTags | undefined) =>
  entity === 'highlights' && value?.color === '' && Object.keys(value.tags || {}).length === 0

const assignTagToEntity = (
  bible: BibleTagAssignmentsState,
  entity: TaggableEntity,
  entityId: string,
  tagId: string,
  title?: string
) => {
  const entityCollection = getEntityCollection(bible, entity)
  const tag = bible.tags[tagId]
  ensureTagEntityIndex(bible, tagId, entity)[entityId] = true

  if (entity === 'highlights' && !entityCollection[entityId]) {
    entityCollection[entityId] = {
      color: '',
      date: Date.now(),
      tags: {},
    }
  }

  if (!entityCollection[entityId]) {
    entityCollection[entityId] = {
      id: entityId,
      title,
      tags: {},
    }
  }

  if (!entityCollection[entityId].tags) {
    entityCollection[entityId].tags = {}
  }

  entityCollection[entityId].tags![tagId] = {
    id: tagId,
    name: tag.name,
  }
}

const unassignTagFromEntity = (
  bible: BibleTagAssignmentsState,
  entity: TaggableEntity,
  entityId: string,
  tagId: string
) => {
  const entityCollection = getEntityCollection(bible, entity)

  delete bible.tags[tagId][entity]?.[entityId]
  delete entityCollection[entityId]?.tags?.[tagId]

  if (shouldDeleteEmptyHighlight(entity, entityCollection[entityId])) {
    delete entityCollection[entityId]
    return
  }

  if (
    isEphemeralTagOnlyEntity(entity) &&
    Object.keys(entityCollection[entityId]?.tags || {}).length === 0
  ) {
    delete entityCollection[entityId]
  }
}

export const removeEntityFromTagAssignments = (
  bible: BibleTagAssignmentsState,
  entity: Extract<TaggableEntity, 'notes' | 'links' | 'highlights' | 'studies' | 'wordAnnotations'>,
  entityId: string
) => {
  for (const tag of Object.values(bible.tags)) {
    if (tag[entity]) {
      delete tag[entity][entityId]
    }
  }
}

export const renameTagAssignment = (
  bible: BibleTagAssignmentsState,
  tagId: string,
  name: string
) => {
  bible.tags[tagId].name = name

  entitiesArray.forEach(entity => {
    const entities = getEntityCollection(bible, entity)
    Object.values(entities).forEach(item => {
      if (item.tags?.[tagId]) {
        item.tags[tagId].name = name
      }
    })
  })
}

export const removeTagAssignments = (bible: BibleTagAssignmentsState, tagId: string) => {
  delete bible.tags[tagId]

  entitiesArray.forEach(entity => {
    const entities = getEntityCollection(bible, entity)
    Object.values(entities).forEach(item => {
      if (item.tags?.[tagId]) {
        delete item.tags[tagId]
      }
    })
  })
}

export const toggleTagAssignment = (
  bible: BibleTagAssignmentsState,
  item: ToggleTagEntityItem,
  tagId: string
) => {
  const entityCollection = getEntityCollection(bible, item.entity)

  if (item.ids) {
    const ids = Object.keys(item.ids)
    const firstId = ids[0]
    const hasTag = entityCollection[firstId]?.tags?.[tagId]

    ids.forEach(id => {
      if (hasTag) {
        unassignTagFromEntity(bible, item.entity, id, tagId)
      } else {
        assignTagToEntity(bible, item.entity, id, tagId)
      }
    })
    return
  }

  const entityId = item.id!
  if (entityCollection[entityId]?.tags?.[tagId]) {
    unassignTagFromEntity(bible, item.entity, entityId, tagId)
  } else {
    assignTagToEntity(bible, item.entity, entityId, tagId, item.title)
  }
}
