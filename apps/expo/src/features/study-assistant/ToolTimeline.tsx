import { useState } from 'react'
import { ActivityIndicator } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import type { ToolActivity } from '@bible-strong/ai-contract/contract'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useTheme } from '~themes/ThemeProvider'
import {
  toolActivityChip,
  toolActivityDetail,
  toolActivityFailed,
  toolActivityIsSearch,
  toolActivityKind,
} from './toolActivity'

const iconFor = (tool: ToolActivity) => {
  if (toolActivityFailed(tool)) return 'alert-circle' as const
  if (toolActivityIsSearch(tool)) return 'search' as const
  const kind = toolActivityKind(tool)
  if (kind === 'library') return 'book' as const
  if (kind === 'document') return 'file-text' as const
  if (kind === 'reference') return 'user' as const
  if (kind === 'editorial') return 'calendar' as const
  if (kind === 'tab') return 'external-link' as const
  if (kind === 'passage') return 'book-open' as const
  if (kind === 'strong') return 'type' as const
  if (kind === 'commentary' || kind === 'dictionary') return 'file-text' as const
  if (kind === 'nave') return 'search' as const
  return 'tool' as const
}

/**
 * Resources the assistant consulted: open while it searches, folded as soon as its answer
 * starts (2026-11-08), and open again on a tap. Each line says what it found when the service
 * tells (2026-11-12); the step the assistant is at shows in the thread's progress line.
 */
export default function ToolTimeline({
  tools,
  running,
  writing,
}: {
  tools: ToolActivity[]
  /** The run is going: a resource still being read shows its activity. */
  running: boolean
  /** The answer has started to show. */
  writing: boolean
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const [expanded, setExpanded] = useState(false)
  // Measured once laid out, so the list folds and unfolds instead of jumping.
  const [listHeight, setListHeight] = useState<number>()
  const active = running && tools.some(tool => tool.state === 'running')
  const searching = running && !writing
  const open = searching || expanded
  return (
    <Box className="mb-3">
      <TouchableBox
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        disabled={searching}
        onPress={() => setExpanded(value => !value)}
        className="flex-row items-center gap-2 py-1"
      >
        {active ? (
          <ActivityIndicator size="small" color={colors.grey} />
        ) : (
          <FeatherIcon name="layers" size={14} color="grey" />
        )}
        <Text className="text-grey text-[13px]">
          {t('assistant.tools.title', { count: tools.length })}
        </Text>
        {!searching && (
          <FeatherIcon name={open ? 'chevron-up' : 'chevron-down'} size={14} color="grey" />
        )}
      </TouchableBox>
      <Animated.View
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        style={{
          overflow: 'hidden',
          height: open ? listHeight : 0,
          transitionProperty: 'height',
          transitionDuration: 220,
          transitionTimingFunction: 'ease-out',
        }}
      >
        <Box
          onLayout={event => setListHeight(event.nativeEvent.layout.height)}
          className="ml-[6px] mt-1 gap-2 border-l border-border pl-3"
        >
          {tools.map(tool => {
            const failed = toolActivityFailed(tool)
            const detail = toolActivityDetail(tool, t)
            return (
              <VStack key={tool.callId} className="gap-[2px]">
                <HStack className="items-center gap-2">
                  <FeatherIcon name={iconFor(tool)} size={13} color={failed ? 'quart' : 'grey'} />
                  {/* One line per step: the label stays whole, the target ends in an ellipsis. */}
                  <Text className="text-grey shrink-0 text-[13px]" numberOfLines={1}>
                    {t(`assistant.tools.${toolActivityKind(tool)}`)}
                    {failed ? ` · ${t(`assistant.tools.${tool.state}`)}` : ''}
                  </Text>
                  <Box className="bg-light-grey shrink rounded-full px-2 py-[2px]">
                    <Text className="text-[12px]" numberOfLines={1}>
                      {toolActivityChip(tool, t)}
                    </Text>
                  </Box>
                </HStack>
                {/* What the read found, under its label (the icon and its gap are 21 points). */}
                {!!detail && (
                  <Text className="text-grey ml-[21px] text-[12px]" numberOfLines={2}>
                    {detail}
                  </Text>
                )}
              </VStack>
            )
          })}
        </Box>
      </Animated.View>
    </Box>
  )
}
