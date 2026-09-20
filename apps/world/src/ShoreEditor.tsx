import { useEffect, useReducer } from 'react'
import type { ShoreEditorModel } from './shorelines'
import './shore-editor.css'
export const shoreCopy = {
  fr: {
    title: 'Rivages',
    close: 'Retour au world',
    hint: 'Trace la limite entre la terre et l’eau. La ligne turquoise indique le côté des vagues.',
    draw: 'Tracer',
    edit: 'Ajuster',
    pan: 'Déplacer la vue',
    select: 'Rivage',
    empty: 'Aucun tracé',
    closed: 'Contour fermé (rocher, île)',
    flip: 'Inverser le côté de l’eau',
    width: 'Largeur',
    period: 'Période (secondes)',
    strength: 'Intensité',
    guides: 'Afficher les repères',
    pause: 'Figer les vagues',
    focus: 'Centrer le tracé',
    undo: 'Annuler',
    remove: 'Supprimer',
    example: 'Exemple · côte centrale',
    saved: 'Sauvegardé dans le projet',
    error: 'Sauvegarde impossible. Vérifie que le serveur local est lancé.',
    save: 'Sauvegarder',
    saving: 'Sauvegarde…',
    unsaved: 'Modifications à sauvegarder',
    loading: 'Chargement des rivages…',
    reduced: 'Réduction des animations activée : aperçu fixe.',
    zoom: 'Zoom',
    tip: 'Tracer : glisse sur la côte. Ajuster : déplace les points jaunes. Déplacer la vue : glisse sur la carte. Molette pour zoomer.',
  },
  en: {
    title: 'Shorelines',
    close: 'Back to world',
    hint: 'Trace the boundary between land and water. The turquoise line marks the wave side.',
    draw: 'Draw',
    edit: 'Adjust',
    pan: 'Pan view',
    select: 'Shoreline',
    empty: 'No shorelines',
    closed: 'Closed outline (rock, island)',
    flip: 'Flip water side',
    width: 'Width',
    period: 'Period (seconds)',
    strength: 'Intensity',
    guides: 'Show guides',
    pause: 'Freeze waves',
    focus: 'Focus outline',
    undo: 'Undo',
    remove: 'Delete',
    example: 'Example · central coast',
    saved: 'Saved in the project',
    error: 'Cannot save. Check that the local server is running.',
    save: 'Save',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    loading: 'Loading shorelines…',
    reduced: 'Reduced motion enabled: static preview.',
    zoom: 'Zoom',
    tip: 'Draw: drag along the coast. Adjust: drag yellow points. Pan view: drag the map. Scroll to zoom.',
  },
  zh: {
    title: '海岸线',
    close: '返回世界',
    hint: '沿陆地与水面的边界描画。青色线标示波浪所在的一侧。',
    draw: '绘制',
    edit: '调整',
    pan: '移动视图',
    select: '海岸线',
    empty: '暂无线条',
    closed: '闭合轮廓（岩石、岛屿）',
    flip: '切换水面方向',
    width: '宽度',
    period: '周期（秒）',
    strength: '强度',
    guides: '显示辅助线',
    pause: '暂停波浪',
    focus: '居中显示',
    undo: '撤销',
    remove: '删除',
    example: '示例 · 中央海岸',
    saved: '已保存到项目',
    error: '无法保存，请检查本地服务器是否运行。',
    save: '保存',
    saving: '正在保存…',
    unsaved: '有未保存的更改',
    loading: '正在加载海岸线…',
    reduced: '已开启减少动态效果：静态预览。',
    zoom: '缩放',
    tip: '绘制：沿海岸拖动。调整：拖动黄色点。移动视图：拖动地图。滚动缩放。',
  },
}
export function ShoreEditor({
  model,
  language,
  onClose,
  onZoom,
}: {
  model: ShoreEditorModel
  language: keyof typeof shoreCopy
  onClose: () => void
  onZoom: (factor: number) => void
}) {
  const [, refresh] = useReducer(n => n + 1, 0)
  useEffect(() => model.subscribe(refresh), [model])
  const t = shoreCopy[language],
    line = model.lines.find(line => line.id === model.selected)
  return (
    <aside className="shore-editor" aria-label={t.title}>
      <header>
        <h2>{t.title}</h2>
        <button onClick={onClose}>{t.close} ↗</button>
      </header>
      <p>{t.hint}</p>
      <div className="shore-tools">
        {(['pan', 'draw', 'edit'] as const).map(mode => (
          <button
            key={mode}
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
      <small>{t.tip}</small>
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
        {t.select}
        <select
          value={model.selected}
          onChange={e => {
            model.selected = e.target.value
            model.notify()
          }}
        >
          {!model.lines.length && <option value="">{t.empty}</option>}
          {model.lines.map((line, i) => (
            <option key={line.id} value={line.id}>
              {t.select} {i + 1}
            </option>
          ))}
        </select>
      </label>
      {line && (
        <>
          <button
            onClick={() => {
              model.focus++
              model.notify()
            }}
          >
            {t.focus}
          </button>
          <label className="shore-check">
            <input
              type="checkbox"
              checked={line.closed}
              onChange={e => model.change({ closed: e.target.checked })}
            />
            {t.closed}
          </label>
          <button onClick={() => model.change({ side: -line.side })}>{t.flip}</button>
          {(
            [
              { key: 'width', min: 4, max: 40, step: 1 },
              { key: 'period', min: 2, max: 8, step: 0.5 },
              { key: 'strength', min: 0.1, max: 0.85, step: 0.05 },
            ] as const
          ).map(({ key, ...range }) => (
            <label key={key}>
              {t[key]} <output>{line[key].toFixed(key === 'strength' ? 2 : 1)}</output>
              <input
                type="range"
                {...range}
                value={line[key]}
                onChange={e => model.change({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </>
      )}
      <label className="shore-check">
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
      <label className="shore-check">
        <input
          type="checkbox"
          checked={model.paused}
          onChange={e => {
            model.paused = e.target.checked
            model.notify()
          }}
        />
        {t.pause}
      </label>
      <div className="shore-tools">
        <button onClick={() => model.undo()}>{t.undo}</button>
        <button disabled={!line} onClick={() => model.remove()}>
          {t.remove}
        </button>
      </div>
      <button
        onClick={() => {
          model.add([
            [570, 405],
            [560, 418],
            [550, 432],
            [542, 447],
            [543, 462],
            [551, 476],
            [570, 490],
          ])
          model.focus++
          model.mode = 'edit'
          model.notify()
        }}
      >
        {t.example}
      </button>
      <button disabled={!model.loaded || model.saving} onClick={() => void model.saveProject()}>
        {model.saving ? t.saving : t.save}
      </button>
      <small role="status">
        {model.saveError ? t.error : !model.loaded ? t.loading : model.dirty ? t.unsaved : t.saved}
      </small>
      {window.matchMedia('(prefers-reduced-motion: reduce)').matches && <small>{t.reduced}</small>}
    </aside>
  )
}
