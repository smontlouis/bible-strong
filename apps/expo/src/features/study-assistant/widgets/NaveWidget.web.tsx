import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { useTranslation } from 'react-i18next'
import { ArrowUpRightIcon } from 'lucide-react'
import type { NaveWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import ResourcePreviewContent from '~features/bibleReferencePreview/ResourcePreviewContent'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import WidgetFrame from './WidgetFrame.web'
export default function NaveWidget({ widget }: { widget: Descriptor }) {
  const { fontFamily } = useTheme()
  const { t } = useTranslation(),
    navigate = usePushRouteOnce()
  return (
    <WidgetFrame title={widget.title} eyebrow={t('assistant.widgets.nave')}>
      <div className="bs-widget-nave">
        <ResourcePreviewContent
          typography={{
            fontFamily: resolveFontFamily(fontFamily.text) || 'sans-serif',
            fontSize: 14,
            lineHeight: 24,
          }}
          target={{
            kind: 'nave',
            name: widget.topic,
            title: widget.title,
            source: { kind: 'nave', language: widget.language },
          }}
        />
      </div>
      <footer className="bs-widget-footer">
        <span>Nave · {widget.language.toUpperCase()}</span>
        <button
          type="button"
          onClick={() =>
            navigate({
              pathname: '/nave-detail',
              params: { name: widget.topic, name_lower: widget.topic, language: widget.language },
            })
          }
        >
          {t('assistant.widgets.openTopic')}
          <ArrowUpRightIcon size={15} />
        </button>
      </footer>
    </WidgetFrame>
  )
}
