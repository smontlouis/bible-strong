import { useEffect, useReducer } from 'react'
import type { AmbientEditorModel, AmbientKind } from './ambient-zones'
import './world-editor.css'
export type EditorMode = 'shorelines' | 'navigation' | AmbientKind
export const editorCopy = {
  fr: {
    title: 'Atelier du monde',
    open: 'Éditer le monde',
    close: 'Terminer',
    shorelines: 'Rivages',
    navigation: 'Accès',
    particles: 'Particules',
    butterfly: 'Papillons',
    light: 'Lueurs',
    dragonfly: 'Libellules',
    select: 'Sélectionner',
    draw: 'Nouvelle zone',
    pan: 'Déplacer la vue',
    zone: 'Zone',
    empty: 'Aucune zone',
    name: 'Nom',
    enabled: 'Zone active',
    count: 'Nombre',
    size: 'Taille',
    speed: 'Vitesse',
    intensity: 'Intensité',
    opacity: 'Opacité',
    luminosity: 'Intensité lumineuse',
    color: 'Couleur',
    style: 'Type',
    round: 'Rondes',
    leaf: 'Feuilles',
    petal: 'Pétales',
    sparkle: 'Étincelles',
    glow: 'Halo doux',
    lantern: 'Lanterne',
    width: 'Largeur',
    height: 'Hauteur',
    focus: 'Centrer',
    guides: 'Afficher les contours',
    undo: 'Annuler',
    remove: 'Supprimer',
    save: 'Sauvegarder',
    saved: 'Sauvegardé dans le projet',
    dirty: 'Modifications à sauvegarder',
    saving: 'Sauvegarde…',
    error:
      'Impossible de charger ou sauvegarder. Vérifie le serveur local et les limites des réglages.',
    hint: 'Dessine un rectangle pour créer une zone. Déplace son intérieur ou tire ses coins pour la redimensionner.',
    preview: 'Aperçu en direct',
    limit: 'Jusqu’à 80 zones et 600 éléments au total.',
    zoom: 'Zoom',
    loading: 'Chargement…',
  },
  en: {
    title: 'World workshop',
    open: 'Edit world',
    close: 'Done',
    shorelines: 'Shorelines',
    navigation: 'Access',
    particles: 'Particles',
    butterfly: 'Butterflies',
    light: 'Glows',
    dragonfly: 'Dragonflies',
    select: 'Select',
    draw: 'New zone',
    pan: 'Pan view',
    zone: 'Zone',
    empty: 'No zones',
    name: 'Name',
    enabled: 'Zone enabled',
    count: 'Count',
    size: 'Size',
    speed: 'Speed',
    intensity: 'Intensity',
    opacity: 'Opacity',
    luminosity: 'Glow intensity',
    color: 'Color',
    style: 'Type',
    round: 'Round',
    leaf: 'Leaves',
    petal: 'Petals',
    sparkle: 'Sparkles',
    glow: 'Soft halo',
    lantern: 'Lantern',
    width: 'Width',
    height: 'Height',
    focus: 'Focus',
    guides: 'Show outlines',
    undo: 'Undo',
    remove: 'Delete',
    save: 'Save',
    saved: 'Saved in the project',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    error: 'Cannot load or save. Check the local server and setting limits.',
    hint: 'Draw a rectangle to create a zone. Drag inside to move it, or drag its corners to resize.',
    preview: 'Live preview',
    limit: 'Up to 80 zones and 600 objects in total.',
    zoom: 'Zoom',
    loading: 'Loading…',
  },
  zh: {
    title: '世界编辑器',
    open: '编辑世界',
    close: '完成',
    shorelines: '海岸线',
    navigation: '通行',
    particles: '粒子',
    butterfly: '蝴蝶',
    light: '灯光',
    dragonfly: '蜻蜓',
    select: '选择',
    draw: '新建区域',
    pan: '移动视图',
    zone: '区域',
    empty: '暂无区域',
    name: '名称',
    enabled: '启用区域',
    count: '数量',
    size: '大小',
    speed: '速度',
    intensity: '强度',
    opacity: '不透明度',
    luminosity: '发光强度',
    color: '颜色',
    style: '类型',
    round: '圆形',
    leaf: '树叶',
    petal: '花瓣',
    sparkle: '闪光',
    glow: '柔和光晕',
    lantern: '灯笼',
    width: '宽度',
    height: '高度',
    focus: '居中',
    guides: '显示轮廓',
    undo: '撤销',
    remove: '删除',
    save: '保存',
    saved: '已保存到项目',
    dirty: '有未保存的更改',
    saving: '正在保存…',
    error: '无法加载或保存，请检查本地服务器和参数范围。',
    hint: '拖动绘制矩形以创建区域。拖动内部移动区域，拖动角点调整大小。',
    preview: '实时预览',
    limit: '最多80个区域，共600个元素。',
    zoom: '缩放',
    loading: '加载中…',
  },
}
export function EditorNavigation({
  mode,
  language,
  onMode,
  onClose,
}: {
  mode: EditorMode
  language: keyof typeof editorCopy
  onMode: (m: EditorMode) => void
  onClose: () => void
}) {
  const t = editorCopy[language]
  return (
    <nav className="world-editor-navigation" aria-label={t.title}>
      <strong>{t.title}</strong>
      <div className="world-editor-tabs">
        {(
          ['navigation', 'shorelines', 'particles', 'butterfly', 'light', 'dragonfly'] as const
        ).map(key => (
          <button key={key} aria-pressed={mode === key} onClick={() => onMode(key)}>
            {t[key]}
          </button>
        ))}
      </div>
      <button className="editor-done" onClick={onClose}>
        {t.close} ↗
      </button>
    </nav>
  )
}
export function AmbientEditorPanel({
  model,
  language,
  onZoom,
}: {
  model: AmbientEditorModel
  language: keyof typeof editorCopy
  onZoom: (factor: number) => void
}) {
  const [, refresh] = useReducer(n => n + 1, 0)
  useEffect(() => model.subscribe(refresh), [model])
  const t = editorCopy[language],
    zone = model.zones.find(z => z.id === model.selected && z.kind === model.kind)
  return (
    <aside className="shore-editor ambient-editor" aria-label={t[model.kind]}>
      <header>
        <h2>{t[model.kind]}</h2>
        <span className="editor-live">● {t.preview}</span>
      </header>
      <p>{t.hint}</p>
      <div className="shore-tools">
        {(['select', 'draw', 'pan'] as const).map(mode => (
          <button
            key={mode}
            disabled={!model.loaded}
            aria-pressed={model.mode === mode}
            onClick={() => {
              model.mode = mode
              model.notify()
            }}
          >
            {t[mode]}
          </button>
        ))}
      </div>
      <div className="shore-tools">
        <span>{t.zoom}</span>
        <button aria-label={`${t.zoom} −`} onClick={() => onZoom(0.8)}>
          −
        </button>
        <button aria-label={`${t.zoom} +`} onClick={() => onZoom(1.25)}>
          +
        </button>
      </div>
      <label>
        {t.zone}
        <select
          value={zone?.id ?? ''}
          onChange={e => {
            model.selected = e.target.value
            model.focus++
            model.notify()
          }}
        >
          {!model.zones.some(z => z.kind === model.kind) && <option value="">{t.empty}</option>}
          {model.zones
            .filter(z => z.kind === model.kind)
            .map((z, i) => (
              <option key={z.id} value={z.id}>
                {z.name || `${t[model.kind]} ${i + 1}`}
              </option>
            ))}
        </select>
      </label>
      {zone && (
        <>
          <label>
            {t.name}
            <input
              type="text"
              maxLength={100}
              value={zone.name}
              onChange={e => model.change({ name: e.target.value })}
            />
          </label>
          <div className="shore-tools">
            <button
              onClick={() => {
                model.focus++
                model.notify()
              }}
            >
              {t.focus}
            </button>
            <label>
              <input
                type="checkbox"
                checked={zone.enabled}
                onChange={e => model.change({ enabled: e.target.checked })}
              />
              {t.enabled}
            </label>
          </div>
          {(model.kind === 'particles' || model.kind === 'light') && (
            <label>
              {t.style}
              <select
                value={zone.style}
                onChange={e => model.change({ style: e.target.value as typeof zone.style })}
              >
                {(model.kind === 'particles'
                  ? (['round', 'leaf', 'petal', 'sparkle'] as const)
                  : (['glow', 'lantern', 'sparkle'] as const)
                ).map(style => (
                  <option key={style} value={style}>
                    {t[style]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {model.kind === 'light' ? (
            <label>
              {t.size}
              <output>{Math.round(Math.max(zone.width, zone.height))}</output>
              <input
                type="range"
                aria-label={t.size}
                min={Math.ceil(
                  (12 * Math.max(zone.width, zone.height)) / Math.min(zone.width, zone.height)
                )}
                max={1200}
                step={1}
                value={Math.max(zone.width, zone.height)}
                onChange={e => {
                  const scale = e.target.valueAsNumber / Math.max(zone.width, zone.height)
                  const width = Math.max(12, Math.min(1200, zone.width * scale))
                  const height = Math.max(12, Math.min(1200, zone.height * scale))
                  model.change({
                    x: zone.x + (zone.width - width) / 2,
                    y: zone.y + (zone.height - height) / 2,
                    width,
                    height,
                  })
                }}
              />
            </label>
          ) : (
            <div className="editor-dimensions">
              {(['width', 'height'] as const).map(key => (
                <label key={key}>
                  {t[key]}
                  <input
                    type="number"
                    min={12}
                    max={1200}
                    step={1}
                    value={Math.round(zone[key])}
                    onChange={e => {
                      const n = e.target.valueAsNumber
                      if (Number.isFinite(n) && n >= 12 && n <= 1200) model.change({ [key]: n })
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          {[
            ...(model.kind === 'light'
              ? []
              : [
                  {
                    key: 'count' as const,
                    min: 1,
                    max: model.kind === 'particles' ? 64 : 12,
                    step: 1,
                  },
                  { key: 'size' as const, min: 0.25, max: 4, step: 0.05 },
                ]),
            { key: 'speed' as const, min: 0.1, max: 4, step: 0.1 },
            {
              key: 'intensity' as const,
              min: model.kind === 'particles' ? 0 : 0.05,
              max: 1,
              step: 0.05,
            },
          ].map(({ key, ...range }) => (
            <label key={key}>
              {key === 'intensity' && model.kind === 'particles' ? t.opacity : t[key]}
              <output>{zone[key].toFixed(key === 'count' ? 0 : 2)}</output>
              <input
                type="range"
                {...range}
                value={zone[key]}
                onChange={e => model.change({ [key]: e.target.valueAsNumber })}
              />
            </label>
          ))}
          {model.kind === 'particles' && (
            <label>
              {t.luminosity}
              <output>{Math.round((zone.glow ?? 0) * 100)}%</output>
              <input
                type="range"
                aria-label={t.luminosity}
                min={0}
                max={1}
                step={0.05}
                value={zone.glow ?? 0}
                onChange={e => model.change({ glow: e.target.valueAsNumber })}
              />
            </label>
          )}
          <label>
            {t.color}
            <input
              type="color"
              value={zone.color}
              onChange={e => model.change({ color: e.target.value })}
            />
          </label>
        </>
      )}
      <label>
        <input
          type="checkbox"
          checked={model.guides}
          onChange={e => {
            model.guides = e.target.checked
            model.notify()
          }}
        />
        {t.guides}
      </label>
      <div className="shore-tools">
        <button onClick={() => model.undo()}>{t.undo}</button>
        <button disabled={!zone} onClick={() => model.remove()}>
          {t.remove}
        </button>
      </div>
      <div className="editor-save-bar">
        <button disabled={!model.loaded || model.saving} onClick={() => void model.saveProject()}>
          {model.saving ? t.saving : t.save}
        </button>
        <small role="status">
          {model.error ? t.error : !model.loaded ? t.loading : model.dirty ? t.dirty : t.saved}
        </small>
      </div>
      <small>{t.limit}</small>
    </aside>
  )
}
