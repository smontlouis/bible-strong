import { useTranslation } from 'react-i18next'
import HeaderAction from './HeaderAction'
import { FeatherIcon } from '~common/ui/Icon'
import type { HeaderReplacementProps } from './HeaderReplacement'
export default function HeaderReplacement({ title, onBack, children }: HeaderReplacementProps) {
  const { t } = useTranslation()
  return (
    <HeaderAction>
      <div
        data-contextual-header-replacement
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
      >
        <button className="bs-panel-back" aria-label={t('Retour')} onClick={onBack}>
          <FeatherIcon name="arrow-left" size={17} />
        </button>
        <h2 style={{ flex: 1 }}>{title}</h2>
        {children}
      </div>
    </HeaderAction>
  )
}
