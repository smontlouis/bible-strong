import { useState } from 'react'
import { Popover } from '@heroui/react/popover'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import { useTheme } from '~themes/ThemeProvider'
import { webFontFamily } from '~helpers/webFontFamily'
import { useAllColors } from '~helpers/useColorName'
import { FeatherIcon } from '~common/ui/Icon'
import { changeHighlightColor, removeHighlight, toggleTagEntity } from '~redux/modules/user'
import {
  changeWordAnnotationColor,
  removeWordAnnotationAction,
} from '~redux/modules/user/wordAnnotations'
import type { HighlightOptionsProps } from './HighlightOptions'
import './FiltersHeader.web.css'

export default function HighlightOptions({ verseIds, annotationId, color }: HighlightOptionsProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const dispatch = useDispatch()
  const colors = useAllColors()
  const tags = useSelector((state: RootState) => state.user.bible.tags)
  const entities = useSelector((state: RootState) =>
    annotationId ? state.user.bible.wordAnnotations : state.user.bible.highlights
  )
  const entityIds = annotationId ? [annotationId] : Object.keys(verseIds ?? {})
  const [query, setQuery] = useState('')
  const matchingTags = Object.values(tags ?? {})
    .filter(tag => tag && typeof tag.name === 'string' && typeof tag.id === 'string')
    .filter(tag => tag.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'actions' | 'colors' | 'tags' | 'delete'>('actions')
  return (
    <Popover
      isOpen={open}
      onOpenChange={value => {
        setOpen(value)
        if (!value) {
          setView('actions')
          setQuery('')
        }
      }}
    >
      <Popover.Trigger
        className="bs-highlight-options-trigger"
        aria-label={t('accessibility.options')}
      >
        <FeatherIcon name="more-vertical" size={20} />
      </Popover.Trigger>
      <Popover.Content
        className="bs-filter-popover"
        placement="bottom end"
        offset={6}
        style={{
          width: 280,
          background: theme.colors.reverse,
          color: theme.colors.default,
          borderColor: theme.colors.border,
          fontFamily: webFontFamily(theme.fontFamily.text),
          fontSize: 14,
          lineHeight: '20px',
        }}
      >
        <Popover.Dialog>
          <div className="bs-filter-heading">
            {view !== 'actions' && (
              <button aria-label={t('Retour')} onClick={() => setView('actions')}>
                <FeatherIcon name="arrow-left" size={17} />
              </button>
            )}
            <Popover.Heading style={{ fontFamily: webFontFamily(theme.fontFamily.title) }}>
              {view === 'colors'
                ? t('Changer la couleur')
                : view === 'tags'
                  ? t('Éditer les tags')
                  : view === 'delete'
                    ? t('Supprimer')
                    : t('Surbrillances')}
            </Popover.Heading>
          </div>
          {view === 'actions' ? (
            <>
              <button className="bs-filter-row" onClick={() => setView('colors')}>
                <FeatherIcon name="droplet" size={17} />
                <span className="bs-filter-label">{t('Changer la couleur')}</span>
                <FeatherIcon name="chevron-right" size={15} />
              </button>
              <button className="bs-filter-row" onClick={() => setView('tags')}>
                <FeatherIcon name="tag" size={17} />
                <span>{t('Éditer les tags')}</span>
              </button>
              <button
                className="bs-filter-row"
                style={{ color: theme.colors.quart }}
                onClick={() => setView('delete')}
              >
                <FeatherIcon name="trash-2" size={17} color="quart" />
                <span>{t('Supprimer')}</span>
              </button>
            </>
          ) : view === 'tags' ? (
            <>
              <input
                className="bs-tag-search"
                aria-label={t('Rechercher')}
                placeholder={t('Rechercher')}
                value={query}
                onChange={event => setQuery(event.target.value)}
                style={{ borderColor: theme.colors.border, color: theme.colors.default }}
              />
              <div className="bs-filter-options">
                {matchingTags.map(tag => {
                  const checked = entityIds.some(id => Boolean(entities?.[id]?.tags?.[tag.id]))
                  return (
                    <label className="bs-filter-row" key={tag.id} style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        style={{ accentColor: theme.colors.primary }}
                        onChange={() => {
                          dispatch(
                            toggleTagEntity({
                              tagId: tag.id,
                              item: annotationId
                                ? { entity: 'wordAnnotations', id: annotationId }
                                : { entity: 'highlights', ids: verseIds },
                            })
                          )
                        }}
                      />
                      <span className="bs-filter-label">{tag.name}</span>
                    </label>
                  )
                })}
                {!matchingTags.length && <p style={{ padding: 8 }}>{t('Aucun résultat')}</p>}
              </div>
            </>
          ) : view === 'colors' ? (
            <div className="bs-filter-options">
              {colors.map(option => (
                <button
                  className="bs-filter-row"
                  key={option.id}
                  onClick={() => {
                    if (annotationId) dispatch(changeWordAnnotationColor(annotationId, option.id))
                    else if (verseIds) dispatch(changeHighlightColor(verseIds, option.id))
                    setOpen(false)
                    setView('actions')
                  }}
                >
                  <span className="bs-filter-color" style={{ background: option.hex }} />
                  <span className="bs-filter-label">{option.name}</span>
                  {color === option.id && <FeatherIcon name="check" size={17} color="primary" />}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: 8 }}>
              <p>
                {t(
                  annotationId
                    ? 'Êtes-vous vraiment sur de supprimer cette annotation ?'
                    : 'Êtes-vous vraiment sur de supprimer cette surbrillance ?'
                )}
              </p>
              <button className="bs-filter-row" onClick={() => setView('actions')}>
                {t('Non')}
              </button>
              <button
                className="bs-filter-row"
                style={{ color: theme.colors.quart }}
                onClick={() => {
                  if (annotationId) dispatch(removeWordAnnotationAction(annotationId))
                  else if (verseIds) dispatch(removeHighlight({ selectedVerses: verseIds }))
                  setOpen(false)
                }}
              >
                {t('Oui')}
              </button>
            </div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
