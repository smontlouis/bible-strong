import WidgetSelect from './WidgetSelect.web'

export default function VersionSelect({
  label,
  value,
  versions,
  onChange,
}: {
  label: string
  value: string
  versions: string[]
  onChange: (version: string) => void
}) {
  return (
    <WidgetSelect
      label={label}
      value={value}
      items={versions.map(id => ({ id, label: id }))}
      onChange={onChange}
    />
  )
}
