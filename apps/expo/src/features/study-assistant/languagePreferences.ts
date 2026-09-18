/** Keep reading context, normal Bible and Strong Bible preferences independent. */
export function assistantLanguagePreferences(
  language: string,
  defaultBibleVersion?: string,
  readingBibleVersion?: string,
  defaultStrongBibleVersion?: string
) {
  const appLanguage = language.toLowerCase().startsWith('en') ? 'en' : 'fr'
  const languageDefault = appLanguage === 'en' ? 'KJV' : 'LSG'
  return {
    appLanguage,
    defaultBibleVersion: defaultBibleVersion || languageDefault,
    defaultStrongBibleVersion: defaultStrongBibleVersion || languageDefault,
    ...(readingBibleVersion ? { readingBibleVersion } : {}),
  } as const
}

/** Use a uniquely known source edition for ordinary links, never a guessed global default. */
export function responseBibleVersion(
  sources: import('@bible-strong/ai-contract/contract').StudySource[] = [],
  widgets: import('@bible-strong/ai-contract/contract').StudyWidget[] = []
) {
  const versions = new Set(
    [
      ...sources.filter(source => source.kind === 'passage').map(source => source.version),
      ...widgets.flatMap(widget =>
        'passages' in widget
          ? widget.passages.map(p => p.version)
          : widget.kind === 'concordance'
            ? [widget.version || 'LSG']
            : widget.kind === 'book_overview'
              ? [widget.version]
              : []
      ),
    ].filter((version): version is string => Boolean(version))
  )
  return versions.size === 1 ? [...versions][0] : undefined
}
