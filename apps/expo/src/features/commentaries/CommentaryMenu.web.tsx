import CommentarySourceDetails from './CommentarySourceDetails'
import { useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuView } from '~common/ui/MenuView'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import CommentarySelectorSheet, { type CommentaryProjection } from './CommentarySelectorSheet'

export default function CommentaryMenu(
  props: ComponentProps<typeof MenuView> & { direct?: boolean }
) {
  const { t } = useTranslation()
  const [details, setDetails] = useState<CommentaryProjection>()
  if (!props.actions?.some(action => action.id === 'choose-commentaries'))
    return <MenuView {...props} />
  return (
    <ContextualPanel
      trigger={props.children}
      accessibilityLabel={props.accessibilityLabel || t('accessibility.options')}
      width={500}
      initialScreen={props.direct ? 'sources' : 'actions'}
      screens={{
        actions: {
          title: t('Commentaires'),
          content: nav => (
            <>
              {props.actions
                .filter(action => !action.attributes?.hidden)
                .map(action => (
                  <PanelAction
                    key={action.id}
                    label={action.title}
                    icon={action.id === 'choose-commentaries' ? 'check-square' : 'external-link'}
                    nested={action.id === 'choose-commentaries'}
                    onPress={() => {
                      if (action.id === 'choose-commentaries') nav.open('sources')
                      else {
                        nav.close()
                        props.onPressAction?.({ nativeEvent: { event: action.id } } as Parameters<
                          NonNullable<typeof props.onPressAction>
                        >[0])
                      }
                    }}
                  />
                ))}
            </>
          ),
        },
        details: {
          title: details?.entry.title ?? t('Commentaires'),
          content: () => (details ? <CommentarySourceDetails projection={details} /> : null),
        },
        sources: {
          title: t('commentaries.selector.title'),
          content: nav => (
            <CommentarySelectorSheet
              inline
              onOpenDetails={projection => {
                setDetails(projection)
                nav.open('details')
              }}
            />
          ),
        },
      }}
    />
  )
}
