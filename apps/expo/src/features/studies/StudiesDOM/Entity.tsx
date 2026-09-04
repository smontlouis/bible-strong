import React from 'react'
import ArrowRight from './ArrowRight'
import { getStudyEntityBlockDescription, type StudyEntityEmbedPayload } from '../studyEntityEmbeds'
import Strong from './Strong'
import Verse from './Verse'
import EntityTypeIcon from './EntityTypeIcon'
import './entity.css'

export const EntityBlock = (payload: StudyEntityEmbedPayload) => {
  const { endpoint, display } = payload

  if (endpoint.type === 'verse') {
    return (
      <Verse
        title={display.title}
        content={display.description || display.subtitle || ''}
        version={display.chip || display.subtitle || endpoint.version || ''}
      />
    )
  }

  if (endpoint.type === 'strong') {
    return (
      <div className="block-entity--strong" data-entity-type={endpoint.type}>
        <div className="block-entity--type">
          <span className="block-entity--icon">
            <EntityTypeIcon type={endpoint.type} />
          </span>
          <span>{display.typeLabel}</span>
        </div>
        <Strong
          title={display.title}
          codeStrong={display.chip || endpoint.code}
          phonetique={display.subtitle}
          original={display.description}
        />
      </div>
    )
  }

  const description = getStudyEntityBlockDescription(payload)

  return (
    <div className="block-entity--content" data-entity-type={endpoint.type}>
      <div className="block-entity--type">
        <span className="block-entity--icon">
          <EntityTypeIcon type={endpoint.type} />
        </span>
        <span>{display.typeLabel}</span>
      </div>
      <div className="block-entity--title">{display.title}</div>
      {description ? <div className="block-entity--description">{description}</div> : null}
      <div className="block-entity--arrow">
        <ArrowRight color="currentColor" />
      </div>
      <div className="block-delete" />
    </div>
  )
}
