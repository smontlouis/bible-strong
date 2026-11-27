import type { TFunction } from 'i18next'
import type { OnboardingConfig } from './types'

export const ONBOARDING_IDS = {
  ANNOTATION_MODE: 'annotation-mode',
  VERSE_SELECTION: 'verse-selection',
  BOOK_SELECTOR: 'book-selector',
  TABS: 'tabs',
  STUDIES: 'studies',
  BIBLE_AUDIO: 'bible-audio',
  PARALLEL_READING: 'parallel-reading',
  ORIGINAL_TEXT: 'original-text',
} as const

export type OnboardingId = (typeof ONBOARDING_IDS)[keyof typeof ONBOARDING_IDS]

/**
 * The explanations that came after the first one, the annotation mode. A reader who had already
 * been through the app's introduction when they arrived knows these places: they are marked seen.
 */
export const LATER_ONBOARDING_IDS: OnboardingId[] = [
  ONBOARDING_IDS.VERSE_SELECTION,
  ONBOARDING_IDS.BOOK_SELECTOR,
  ONBOARDING_IDS.TABS,
  ONBOARDING_IDS.STUDIES,
  ONBOARDING_IDS.BIBLE_AUDIO,
  ONBOARDING_IDS.PARALLEL_READING,
  ONBOARDING_IDS.ORIGINAL_TEXT,
]

/** Every explanation, in the order the settings list them to be seen again. */
export const ALL_ONBOARDING_IDS: OnboardingId[] = [
  ONBOARDING_IDS.VERSE_SELECTION,
  ONBOARDING_IDS.ANNOTATION_MODE,
  ONBOARDING_IDS.BOOK_SELECTOR,
  ONBOARDING_IDS.ORIGINAL_TEXT,
  ONBOARDING_IDS.PARALLEL_READING,
  ONBOARDING_IDS.TABS,
  ONBOARDING_IDS.STUDIES,
  ONBOARDING_IDS.BIBLE_AUDIO,
]

/** The name of an explanation in the settings. */
export const getOnboardingTitle = (id: OnboardingId, t: TFunction) => t(`onboarding.${id}.name`)

/**
 * The Web and the desktop app are used with a mouse: their explanations keep the text, without the
 * drawn touches, and without the step that only teaches a touch.
 */
export const withoutTouchDemos = (config: OnboardingConfig | null): OnboardingConfig | null =>
  config && {
    ...config,
    steps: config.steps
      .filter(step => step.demo !== 'annotation-double-tap')
      .map(({ demo: _demo, ...step }) => step),
  }

export const getOnboardingConfig = (id: OnboardingId, t: TFunction): OnboardingConfig | null => {
  switch (id) {
    case ONBOARDING_IDS.ANNOTATION_MODE:
      return {
        id,
        steps: [
          {
            title: t('onboarding.annotationMode.step1.title'),
            description: t('onboarding.annotationMode.step1.description'),
          },
          {
            title: t('onboarding.annotationMode.step5.title'),
            description: t('onboarding.annotationMode.step5.description'),
            demo: 'word-double-tap',
          },
          {
            title: t('onboarding.annotationMode.reopen.title'),
            description: t('onboarding.annotationMode.reopen.description'),
            demo: 'annotation-double-tap',
          },
          {
            title: t('onboarding.annotationMode.step2.title'),
            description: t('onboarding.annotationMode.step2.description'),
          },
          {
            title: t('onboarding.annotationMode.step3.title'),
            description: t('onboarding.annotationMode.step3.description'),
          },
        ],
      }
    case ONBOARDING_IDS.VERSE_SELECTION:
      return {
        id,
        steps: [
          {
            title: t('onboarding.verse-selection.tabs.title'),
            description: t('onboarding.verse-selection.tabs.description'),
            demo: 'selection-tabs-swipe',
          },
          {
            title: t('onboarding.verse-selection.colors.title'),
            description: t('onboarding.verse-selection.colors.description'),
            demo: 'color-long-press',
          },
          {
            title: t('onboarding.verse-selection.study.title'),
            description: t('onboarding.verse-selection.study.description'),
          },
        ],
      }
    case ONBOARDING_IDS.BOOK_SELECTOR:
      return {
        id,
        steps: [
          {
            title: t('onboarding.book-selector.newTab.title'),
            description: t('onboarding.book-selector.newTab.description'),
            demo: 'chapter-long-press',
          },
          {
            title: t('onboarding.book-selector.display.title'),
            description: t('onboarding.book-selector.display.description'),
            demo: 'book-selector-display',
          },
        ],
      }
    case ONBOARDING_IDS.TABS:
      return {
        id,
        steps: [
          {
            title: t('onboarding.tabs.swipe.title'),
            description: t('onboarding.tabs.swipe.description'),
            demo: 'tab-bar-swipe',
          },
          {
            title: t('onboarding.tabs.groups.title'),
            description: t('onboarding.tabs.groups.description'),
            demo: 'tab-groups-swipe',
          },
        ],
      }
    case ONBOARDING_IDS.STUDIES:
      return {
        id,
        steps: [
          {
            title: t('onboarding.studies.insert.title'),
            description: t('onboarding.studies.insert.description'),
            demo: 'study-insert',
          },
          {
            title: t('onboarding.studies.share.title'),
            description: t('onboarding.studies.share.description'),
          },
        ],
      }
    case ONBOARDING_IDS.BIBLE_AUDIO:
      return {
        id,
        steps: [
          {
            title: t('onboarding.bible-audio.expand.title'),
            description: t('onboarding.bible-audio.expand.description'),
            demo: 'audio-swipe-up',
          },
        ],
      }
    case ONBOARDING_IDS.PARALLEL_READING:
      return {
        id,
        steps: [
          {
            title: t('onboarding.parallel-reading.columns.title'),
            description: t('onboarding.parallel-reading.columns.description'),
            demo: 'parallel-column-version',
          },
          {
            title: t('onboarding.parallel-reading.menu.title'),
            description: t('onboarding.parallel-reading.menu.description'),
            demo: 'parallel-menu',
          },
        ],
      }
    case ONBOARDING_IDS.ORIGINAL_TEXT:
      return {
        id,
        steps: [
          {
            title: t('onboarding.original-text.tap.title'),
            description: t('onboarding.original-text.tap.description'),
            demo: 'strong-word-tap',
          },
          {
            title: t('onboarding.original-text.switch.title'),
            description: t('onboarding.original-text.switch.description'),
          },
        ],
      }
    default:
      return null
  }
}
