import { Modal } from './Modal'
import { useRef, useState, type CSSProperties } from 'react'
import {
  AVATARS,
  NAME_LIMIT,
  parseProfile,
  type AvatarProfile,
  type AvatarId,
} from './avatar-profile'
import './avatar-editor.css'

export const profileCopy = {
  fr: {
    edit: 'Mon personnage',
    title: 'Fais comme chez toi.',
    intro: 'Un petit compagnon, à ton image.',
    name: 'Ton nom',
    placeholder: 'Comment t’appelles-tu ?',
    avatar: 'Ton avatar',
    color: 'Ta couleur',
    custom: 'Une autre couleur',
    save: 'C’est parti !',
    update: 'Enregistrer',
    close: 'Fermer',
    guest: 'Explorateur',
    storage: 'Profil utilisé pour cette visite. Le navigateur n’a pas pu l’enregistrer.',
    colors: ['Blanc', 'Turquoise', 'Bleu', 'Violet', 'Rose', 'Corail', 'Jaune', 'Vert'],
  },
  en: {
    edit: 'My character',
    title: 'Make yourself at home.',
    intro: 'A little companion, made yours.',
    name: 'Your name',
    placeholder: 'What’s your name?',
    avatar: 'Your avatar',
    color: 'Your color',
    custom: 'Another color',
    save: 'Let’s explore!',
    update: 'Save changes',
    close: 'Close',
    guest: 'Explorer',
    storage: 'Profile applied for this visit. Your browser could not save it.',
    colors: ['White', 'Turquoise', 'Blue', 'Purple', 'Pink', 'Coral', 'Yellow', 'Green'],
  },
}
const COLORS = [
  '#ffffff',
  '#73cdd0',
  '#7398f2',
  '#b39ae9',
  '#f3a3cb',
  '#f09075',
  '#f7d45d',
  '#a2ce86',
]

export function AvatarPreview({ color, avatar }: { color: string; avatar: AvatarId }) {
  const image = (AVATARS.find(item => item.id === avatar) ?? AVATARS[0]).image
  return (
    <span
      className="avatar-art"
      style={{ '--avatar-color': color, '--avatar-image': `url("${image}")` } as CSSProperties}
      aria-hidden="true"
    >
      <img src={image} alt="" draggable={false} />
    </span>
  )
}

export function AvatarEditor({
  profile,
  language,
  onSave,
  onClose,
}: {
  profile: AvatarProfile
  language: keyof typeof profileCopy
  onSave: (profile: AvatarProfile) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(profile)
  const input = useRef<HTMLInputElement>(null)
  const t = profileCopy[language]
  return (
    <Modal
      className="avatar-dialog"
      labelledBy="avatar-title"
      closeLabel={t.close}
      onClose={onClose}
      initialFocus={input}
    >
      <div className="avatar-editor-layout">
        <div className="avatar-stage">
          <span className="avatar-stage-orbit" aria-hidden="true" />
          <span className="avatar-stage-star" aria-hidden="true">
            ✦
          </span>
          <AvatarPreview color={draft.color} avatar={draft.avatar} />
          <span className="avatar-stage-name">{draft.name.trim() || t.guest}</span>
        </div>
        <form
          className="avatar-form"
          onSubmit={event => {
            event.preventDefault()
            const next = parseProfile(draft)
            if (next) onSave(next)
          }}
        >
          <p className="avatar-eyebrow">BIBLE STRONG · WORLD</p>
          <h1 id="avatar-title">{t.title}</h1>
          <p className="avatar-intro">{t.intro}</p>
          <label className="avatar-field" htmlFor="avatar-name">
            {t.name}
          </label>
          <input
            ref={input}
            id="avatar-name"
            className="avatar-name-input"
            autoComplete="nickname"
            maxLength={NAME_LIMIT}
            required
            value={draft.name}
            placeholder={t.placeholder}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
          />
          <fieldset className="avatar-fieldset">
            <legend>{t.avatar}</legend>
            <div className="avatar-options">
              {AVATARS.map(avatar => (
                <button
                  type="button"
                  key={avatar.id}
                  className="avatar-option"
                  aria-pressed={draft.avatar === avatar.id}
                  onClick={() => setDraft({ ...draft, avatar: avatar.id })}
                >
                  <AvatarPreview color={draft.color} avatar={avatar.id} />
                  <span>{avatar.name}</span>
                  <span aria-hidden="true">{draft.avatar === avatar.id ? '✓' : ''}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="avatar-fieldset">
            <legend>{t.color}</legend>
            <div className="avatar-palette">
              {COLORS.map((color, i) => (
                <button
                  type="button"
                  key={color}
                  className="avatar-swatch"
                  style={{ backgroundColor: color }}
                  aria-label={t.colors[i]}
                  aria-pressed={draft.color === color}
                  onClick={() => setDraft({ ...draft, color })}
                >
                  {draft.color === color ? '✓' : ''}
                </button>
              ))}
              <label className="avatar-custom" title={t.custom}>
                <span aria-hidden="true">＋</span>
                <input
                  type="color"
                  value={draft.color}
                  aria-label={t.custom}
                  onChange={e => setDraft({ ...draft, color: e.target.value })}
                />
              </label>
            </div>
          </fieldset>
          <button className="avatar-save" type="submit" disabled={!draft.name.trim()}>
            {profile.name ? t.update : t.save}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>
    </Modal>
  )
}
