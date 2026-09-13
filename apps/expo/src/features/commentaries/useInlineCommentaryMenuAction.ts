import type { MenuAction } from '~common/ui/MenuView'
import { useTranslation } from 'react-i18next'

export function useInlineCommentaryMenuAction(): MenuAction {
  const { t } = useTranslation()
  return { id: 'inline-commentaries', title: t('inlineCommentary.title'), image: 'text.bubble' }
}
