import { parseAvatarBody, parseSurfaceConfig, type AvatarBody } from './body'
import { defaultExpression, initialExpressions } from './presets'
import { surfacePresets, type SurfaceConfig, type SurfaceType } from './surfaces'
import type { Expression } from './geometry'

export type StudioAvatar = {
  id: string
  name: string
  body: AvatarBody
  colors: AvatarColors
  eyes: AvatarEyeDefaults
}

export type AvatarColors = { body: string; eyes: string }
export type AvatarEyeDefaults = Pick<
  Expression,
  | 'widthLeft'
  | 'widthRight'
  | 'heightLeft'
  | 'heightRight'
  | 'spacing'
  | 'positionXLeft'
  | 'positionXRight'
  | 'positionYLeft'
  | 'positionYRight'
  | 'leftAngle'
  | 'rightAngle'
>
export const defaultAvatarColors: AvatarColors = { body: '#5b7fe5', eyes: '#111316' }
export const defaultAvatarEyes: AvatarEyeDefaults = {
  widthLeft: defaultExpression.widthLeft,
  widthRight: defaultExpression.widthRight,
  heightLeft: defaultExpression.heightLeft,
  heightRight: defaultExpression.heightRight,
  spacing: defaultExpression.spacing,
  positionXLeft: defaultExpression.positionXLeft,
  positionXRight: defaultExpression.positionXRight,
  positionYLeft: defaultExpression.positionYLeft,
  positionYRight: defaultExpression.positionYRight,
  leftAngle: defaultExpression.leftAngle,
  rightAngle: defaultExpression.rightAngle,
}
const hexColor = /^#[0-9a-f]{6}$/i
const parseColors = (value: unknown): AvatarColors => {
  const candidate = value as Partial<AvatarColors> | null
  return {
    body:
      typeof candidate?.body === 'string' && hexColor.test(candidate.body)
        ? candidate.body
        : defaultAvatarColors.body,
    eyes:
      typeof candidate?.eyes === 'string' && hexColor.test(candidate.eyes)
        ? candidate.eyes
        : defaultAvatarColors.eyes,
  }
}

const eyeDefaultFields = Object.keys(defaultAvatarEyes) as (keyof AvatarEyeDefaults)[]
export const parseAvatarEyeDefaults = (
  value: unknown,
  legacyPosition?: unknown
): AvatarEyeDefaults => {
  const candidate = value as Partial<AvatarEyeDefaults> | null
  const parsed = { ...defaultAvatarEyes }
  eyeDefaultFields.forEach(field => {
    const stored = candidate?.[field]
    if (typeof stored === 'number' && Number.isFinite(stored)) parsed[field] = stored
  })
  const legacy = legacyPosition as { x?: unknown; y?: unknown } | null
  const legacyX = typeof legacy?.x === 'number' && Number.isFinite(legacy.x) ? legacy.x : 0
  const legacyY = typeof legacy?.y === 'number' && Number.isFinite(legacy.y) ? legacy.y : 0
  if (!candidate) {
    parsed.positionXLeft += legacyX
    parsed.positionXRight += legacyX
    parsed.positionYLeft += legacyY
    parsed.positionYRight += legacyY
  }
  return parsed
}

export const applyAvatarEyeDefaults = (
  expression: Expression,
  eyes: AvatarEyeDefaults = defaultAvatarEyes
): Expression => {
  const result = { ...expression }
  eyeDefaultFields.forEach(field => {
    result[field] = expression[field] + eyes[field] - defaultAvatarEyes[field]
  })
  return result
}

export type AvatarLibrary = {
  activeAvatarId: string
  avatars: StudioAvatar[]
}

const LIBRARY_STORAGE_KEY = 'bible-strong-avatar-library-v1'
const LEGACY_BODY_STORAGE_KEY = 'bible-strong-avatar-body-v1'
const LEGACY_SURFACE_STORAGE_KEY = 'bible-strong-avatar-surface-v1'
const LEGACY_EXPRESSIONS_STORAGE_KEY = 'bible-strong-avatar-expressions-v1'
const surfaceTypes = Object.keys(surfacePresets) as SurfaceType[]

const cloneExpressions = (expressions: Expression[]) => expressions.map(item => ({ ...item }))
const parseExpressions = (value: unknown): Expression[] => {
  if (!Array.isArray(value) || !value.length) return cloneExpressions(initialExpressions)
  return value.map(item => {
    if (!item || typeof item !== 'object') return { ...defaultExpression }
    const candidate = item as Partial<Expression>
    const parsed = Object.fromEntries(
      Object.entries(defaultExpression).map(([field, fallback]) => {
        const stored = candidate[field as keyof Expression]
        return [field, typeof stored === 'number' && Number.isFinite(stored) ? stored : fallback]
      })
    ) as Expression
    if (typeof candidate.bodyColor === 'string' && hexColor.test(candidate.bodyColor))
      parsed.bodyColor = candidate.bodyColor
    if (typeof candidate.eyeColor === 'string' && hexColor.test(candidate.eyeColor))
      parsed.eyeColor = candidate.eyeColor
    return parsed
  })
}

export const loadGlobalExpressions = () => {
  try {
    return parseExpressions(
      JSON.parse(window.localStorage.getItem(LEGACY_EXPRESSIONS_STORAGE_KEY) ?? 'null')
    )
  } catch {
    return cloneExpressions(initialExpressions)
  }
}

export const persistGlobalExpressions = (expressions: Expression[]) => {
  try {
    window.localStorage.setItem(LEGACY_EXPRESSIONS_STORAGE_KEY, JSON.stringify(expressions))
  } catch {
    // Les expressions restent disponibles en mémoire si le stockage est indisponible.
  }
}

const loadLegacySurface = (): SurfaceConfig => {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LEGACY_SURFACE_STORAGE_KEY) ?? 'null'
    ) as Partial<SurfaceConfig> | null
    const type = parsed?.type && surfaceTypes.includes(parsed.type) ? parsed.type : 'sphere'
    return parseSurfaceConfig(parsed, surfacePresets[type])
  } catch {
    return { ...surfacePresets.sphere }
  }
}

const createStrobi = (): StudioAvatar => {
  const fallbackPrimary = loadLegacySurface()
  let body: AvatarBody = { primary: fallbackPrimary, nodes: [] }
  try {
    body = parseAvatarBody(
      JSON.parse(window.localStorage.getItem(LEGACY_BODY_STORAGE_KEY) ?? 'null'),
      fallbackPrimary
    )
  } catch {
    // Les valeurs par défaut restent disponibles si la migration locale est invalide.
  }
  return {
    id: 'strobi',
    name: 'Strobi',
    body,
    colors: { ...defaultAvatarColors },
    eyes: { ...defaultAvatarEyes },
  }
}

export const createAvatar = (name: string): StudioAvatar => ({
  id: `avatar-${crypto.randomUUID()}`,
  name: name.trim() || 'Nouvel avatar',
  body: { primary: { ...surfacePresets.sphere }, nodes: [] },
  colors: { ...defaultAvatarColors },
  eyes: { ...defaultAvatarEyes },
})

export const loadAvatarLibrary = (): AvatarLibrary => {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LIBRARY_STORAGE_KEY) ?? 'null'
    ) as Partial<AvatarLibrary> | null
    if (!parsed || !Array.isArray(parsed.avatars) || !parsed.avatars.length) throw new Error()
    const seenIds = new Set<string>()
    const avatars = parsed.avatars
      .filter(avatar => {
        if (!avatar || typeof avatar.id !== 'string' || typeof avatar.name !== 'string')
          return false
        if (seenIds.has(avatar.id)) return false
        seenIds.add(avatar.id)
        return true
      })
      .map(avatar => ({
        id: avatar.id,
        name: avatar.name,
        body: parseAvatarBody(avatar.body, surfacePresets.sphere),
        colors: parseColors(avatar.colors),
        eyes: parseAvatarEyeDefaults(
          avatar.eyes,
          (avatar as StudioAvatar & { eyePosition?: unknown }).eyePosition
        ),
      }))
    if (!avatars.length) throw new Error()
    const activeAvatarId = avatars.some(avatar => avatar.id === parsed.activeAvatarId)
      ? parsed.activeAvatarId!
      : avatars[0].id
    return { activeAvatarId, avatars }
  } catch {
    const strobi = createStrobi()
    return { activeAvatarId: strobi.id, avatars: [strobi] }
  }
}

export const persistAvatarLibrary = (library: AvatarLibrary) => {
  try {
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library))
  } catch {
    // Le studio continue de fonctionner en mémoire si le stockage est indisponible.
  }
}
