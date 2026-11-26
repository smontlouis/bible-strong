import { useTranslation } from 'react-i18next'

/**
 * The time of a reading reminder on the desktop app, where the system's picker of the mobile apps
 * does not exist: the webview's own time field, set in the app's link colour.
 */
const ReminderTimeField = ({
  time,
  onChange,
}: {
  /** `HH:mm` */
  time: string
  onChange: (time: string) => void
}) => {
  const { t } = useTranslation()
  return (
    <input
      type="time"
      value={time}
      aria-label={t("Choisir l'heure")}
      onChange={event => {
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(event.target.value)) onChange(event.target.value)
      }}
      style={{
        alignSelf: 'flex-start',
        minHeight: 44,
        padding: '0 12px',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        background: 'transparent',
        color: 'var(--color-link)',
        font: 'inherit',
        fontSize: 18,
        fontWeight: 700,
        colorScheme: 'light dark',
      }}
    />
  )
}

export default ReminderTimeField
