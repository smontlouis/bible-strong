import { useTranslation } from 'react-i18next'
import ContextualPanel from './index'
import PanelAction from './PanelAction'
import type { ContextualMenuProps } from './ContextualMenu'

export default function ContextualMenu(props: ContextualMenuProps) {
  const { t } = useTranslation()
  return (
    <ContextualPanel
      commands={
        props.tabActions
          ? {
              actions: props.actions,
              select: (id, nav) => {
                if (props.screens[id]) nav.open(id)
                else props.onPressAction?.({ nativeEvent: { event: id } })
              },
            }
          : undefined
      }
      trigger={props.children}
      accessibilityLabel={props.accessibilityLabel || t('accessibility.options')}
      initialScreen="menu-actions"
      onClose={props.onPanelClose}
      screens={{
        ...Object.fromEntries(
          Object.entries(props.screens).map(([key, screen]) => [
            key,
            { ...screen, width: screen.width ?? props.panelWidth },
          ])
        ),
        'menu-actions': {
          title: props.panelTitle,
          content: navigation => (
            <>
              {props.actions
                ?.filter(
                  (action): action is typeof action & { id: string } =>
                    typeof action.id === 'string' && !action.attributes?.hidden
                )
                .map(action => (
                  <PanelAction
                    key={action.id}
                    label={action.title}
                    icon={props.icons?.[action.id]}
                    disabled={action.attributes?.disabled}
                    destructive={action.attributes?.destructive}
                    nested={Boolean(props.screens[action.id])}
                    onPress={() => {
                      if (props.screens[action.id]) navigation.open(action.id)
                      else {
                        navigation.close()
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
      }}
    />
  )
}
