import { MenuView } from '~common/ui/MenuView'
import { useRef, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import ContextualSheet from '~common/ContextualPanel/ContextualSheet'
import { SheetHeader, type SheetRef } from '~common/sheet'
import InlineCommentarySettings, {
  InlineCommentaryManageAction,
} from '~features/commentaries/InlineCommentarySettings'
import CommentarySelectorSheet from '~features/commentaries/CommentarySelectorSheet'
import { useInlineCommentaryMenuAction } from '~features/commentaries/useInlineCommentaryMenuAction'
type Props = ComponentProps<typeof MenuView> & {
  bookNumber: number
  chapter: number
  version: string
}
export default function BibleOptionsMenu({
  bookNumber: _book,
  chapter: _chapter,
  version: _version,
  actions,
  onPressAction,
  ...props
}: Props) {
  const { t } = useTranslation()
  const inlineSheet = useRef<SheetRef>(null)
  const manageSheet = useRef<SheetRef>(null)
  const action = useInlineCommentaryMenuAction()
  const manage = () => manageSheet.current?.present()
  const menuActions = [...actions]
  menuActions.splice(1, 0, action)
  return (
    <>
      <MenuView
        {...props}
        actions={menuActions}
        onPressAction={event => {
          if (event.nativeEvent.event === action.id) inlineSheet.current?.present()
          else onPressAction?.(event)
        }}
      />
      <ContextualSheet
        ref={inlineSheet}
        header={
          <SheetHeader
            title={t('inlineCommentary.title')}
            rightComponent={<InlineCommentaryManageAction onPress={manage} />}
          />
        }
      >
        <InlineCommentarySettings onManage={manage} />
      </ContextualSheet>
      <CommentarySelectorSheet sheetRef={manageSheet} />
    </>
  )
}
