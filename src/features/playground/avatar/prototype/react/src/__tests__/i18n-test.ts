import { translateStudioText } from '../i18n'

describe('avatar studio translations', () => {
  it('uses English for static interface copy', () => {
    expect(translateStudioText('Couleur des yeux', 'en')).toBe('Eye color')
  })

  it('translates dynamic editor labels', () => {
    expect(translateStudioText('Modifier l’expression 08', 'en')).toBe('Edit expression 08')
    expect(translateStudioText('Sphère · porte les yeux', 'en')).toBe('Sphere · carries the eyes')
    expect(translateStudioText('Cône 1 copie', 'en')).toBe('Cone 1 copy')
  })

  it('keeps the original French copy in French', () => {
    expect(translateStudioText('Nouvel avatar', 'fr')).toBe('Nouvel avatar')
    expect(translateStudioText('sleeping', 'fr')).toBe('sommeil')
  })

  it('translates the studio interface and dynamic labels to Simplified Chinese', () => {
    expect(translateStudioText('Couleur des yeux', 'zh-CN')).toBe('眼睛颜色')
    expect(translateStudioText('Modifier l’expression 08', 'zh-CN')).toBe('编辑表情 08')
    expect(translateStudioText('sleeping', 'zh-CN')).toBe('睡眠')
  })

  it('translates every Photo Mode control to Simplified Chinese', () => {
    expect(translateStudioText('Mode photo', 'zh-CN')).toBe('照片模式')
    expect(translateStudioText('Dégradé radial', 'zh-CN')).toBe('径向渐变')
    expect(translateStudioText('Définition du mode photo', 'zh-CN')).toBe('照片模式分辨率')
    expect(translateStudioText('Télécharger en PNG', 'zh-CN')).toBe('下载 PNG')
  })

  it('covers every configured state description in English', () => {
    expect(translateStudioText('Rythme régulier et expressions concentrées.', 'en')).toBe(
      'Steady rhythm and focused expressions.'
    )
    expect(translateStudioText('Grandes expressions et transitions rapides.', 'en')).toBe(
      'Big expressions and fast transitions.'
    )
    expect(translateStudioText('Inclinaisons et forte asymétrie.', 'en')).toBe(
      'Tilts and strong asymmetry.'
    )
  })
})
