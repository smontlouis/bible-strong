import * as Dialog from '@radix-ui/react-dialog'
import { Fragment, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { SHORTCUT_SECTIONS, isMacPlatform, shortcutKeys } from '~features/keyboard-shortcuts/keymap'
import { paletteScopes } from './scopes'
import { FeatherIcon } from '~common/ui/Icon'

export default function ShortcutGuide({
  open,
  onOpenChange,
  standalone = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opened with ?, outside the palette: no trigger, and closing goes back to the page. */
  standalone?: boolean
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const mac = isMacPlatform()
  const modifier = mac ? 'Ctrl' : 'Alt'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {!standalone && (
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="bs-command-help-button"
            aria-label={t('shortcutGuide.button')}
            title={t('shortcutGuide.button')}
            onKeyDown={event => event.stopPropagation()}
          >
            <span aria-hidden="true">
              <FeatherIcon name="help-circle" size={18} color={theme.colors.primary} />
            </span>
          </button>
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="bs-command-overlay bs-command-help-overlay" />
        <Dialog.Content
          className="bs-command bs-command-dialog bs-command-help"
          onKeyDown={event => event.stopPropagation()}
          style={
            {
              '--command-bg': theme.colors.surfaceRaised,
              '--command-panel': theme.colors.canvas,
              '--command-text': theme.colors.default,
              '--command-muted': theme.colors.tertiary,
              '--command-border': theme.colors.border,
              '--command-active': theme.colors.lightPrimary,
              '--command-primary': theme.colors.primary,
              fontFamily: resolveFontFamily(theme.fontFamily.text),
            } as CSSProperties
          }
        >
          <header className="bs-command-help-header">
            <div>
              <Dialog.Title>{t('shortcutGuide.title')}</Dialog.Title>
              <Dialog.Description>{t('shortcutGuide.description')}</Dialog.Description>
            </div>
            <Dialog.Close
              className="bs-command-help-button"
              aria-label={t(standalone ? 'Fermer' : 'shortcutGuide.back')}
            >
              <span aria-hidden="true">×</span>
            </Dialog.Close>
          </header>
          <div className="bs-command-help-body" tabIndex={0}>
            {SHORTCUT_SECTIONS.map(section => (
              <section key={section.title}>
                <h3>{t(section.title)}</h3>
                <dl className="bs-command-help-shortcuts">
                  {section.rows.map(row => (
                    <div key={row.label}>
                      <dt>{t(row.label)}</dt>
                      <dd>
                        {row.shortcuts.map((id, index) => (
                          <Fragment key={id}>
                            {index > 0 && <span aria-hidden="true">/</span>}
                            {shortcutKeys(id, mac).map(key => (
                              <kbd key={key}>{key}</kbd>
                            ))}
                          </Fragment>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
                {section.hint && <p>{t(section.hint, { modifier })}</p>}
              </section>
            ))}
            <section>
              <h3>{t('shortcutGuide.search')}</h3>
              <dl className="bs-command-help-search">
                <div>
                  <dt>
                    <FeatherIcon name="book-open" size={16} color={theme.colors.primary} />
                    {t('commandPalette.passages')}
                  </dt>
                  <dd>{t('shortcutGuide.passagesHint')}</dd>
                  <dd className="bs-command-help-example">{t('shortcutGuide.passageExample')}</dd>
                </div>
                <div>
                  <dt>
                    <FeatherIcon name="layers" size={16} color={theme.colors.primary} />
                    {t('commandPalette.tabs')}
                  </dt>
                  <dd>{t('shortcutGuide.tabsHint')}</dd>
                  <dd className="bs-command-help-example">{t('shortcutGuide.tabExample')}</dd>
                </div>
                <div>
                  <dt>
                    <FeatherIcon name="sliders" size={16} color={theme.colors.primary} />
                    {t('hotkeys.tabActions')}
                  </dt>
                  <dd>{t('shortcutGuide.actionsHint')}</dd>
                  <dd className="bs-command-help-example">{t('shortcutGuide.actionExample')}</dd>
                </div>
                <div>
                  <dt>
                    <FeatherIcon name="search" size={16} color={theme.colors.primary} />
                    {t('shortcutGuide.fullSearch')}
                  </dt>
                  <dd>{t('shortcutGuide.fullSearchHint')}</dd>
                  <dd className="bs-command-help-example">{t('shortcutGuide.contentExample')}</dd>
                </div>
                <div className="bs-command-help-tools">
                  <dt>
                    <FeatherIcon name="grid" size={16} color={theme.colors.primary} />
                    {t('commandPalette.scopeHeading')}
                  </dt>
                  <dd>{t('shortcutGuide.scopesHint')}</dd>
                  <dd className="bs-command-help-scopes">
                    {paletteScopes.map(scope => (
                      <span key={scope.type}>{t(scope.key)}</span>
                    ))}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
