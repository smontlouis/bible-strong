import blackColors from '~themes/blackColors'
import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import mauveColors from '~themes/mauveColors'
import natureColors from '~themes/natureColors'
import nightColors from '~themes/nightColors'
import sepiaColors from '~themes/sepiaColors'
import sunsetColors from '~themes/sunsetColors'
import { RootState } from './modules/reducer'

export default {
  // Added 'press' in 'settings'
  0: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            press: 'shortPress',
          },
        },
      },
    }
  },
  1: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          changelog: {},
        },
      },
    }
  },
  2: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            notesDisplay: 'inline',
          },
        },
      },
    }
  },
  3: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          studies: {},
          tags: {},
        },
      },
    }
  },
  4: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        id: '',
      },
    }
  },
  5: (state: RootState) => {
    return {
      ...state,
      // @ts-ignore
      bible: {
        // @ts-ignore
        ...state.bible,
      },
    }
  },
  6: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            colors: {
              default: defaultColors,
              dark: darkColors,
            },
          },
        },
      },
    }
  },
  7: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          history: [],
        },
      },
    }
  },
  8: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        notifications: {
          verseOfTheDay: '07:00',
        },
      },
    }
  },
  9: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            commentsDisplay: false,
          },
        },
      },
    }
  },
  10: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            colors: {
              default: {
                color1: state.user.bible.settings.colors.default.color1,
                color2: state.user.bible.settings.colors.default.color2,
                color3: state.user.bible.settings.colors.default.color3,
                color4: state.user.bible.settings.colors.default.color4,
                color5: state.user.bible.settings.colors.default.color5,
              },
              dark: {
                color1: state.user.bible.settings.colors.dark.color1,
                color2: state.user.bible.settings.colors.dark.color2,
                color3: state.user.bible.settings.colors.dark.color3,
                color4: state.user.bible.settings.colors.dark.color4,
                color5: state.user.bible.settings.colors.dark.color5,
              },
            },
          },
        },
      },
    }
  },
  11: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            compare: { LSG: true },
          },
        },
      },
    }
  },
  12: (state: RootState) => {
    return {
      ...state,
      // @ts-ignore
      bible: {
        // @ts-ignore
        ...state.bible,
      },
    }
  },
  13: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        notifications: {
          ...state.user.notifications,
          notificationId: '',
        },
      },
    }
  },
  14: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        changelog: {
          isLoading: true,
          lastSeen: 0,
          data: [],
        },
        needsUpdate: {},
      },
    }
  },
  15: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        fontFamily: '',
      },
    }
  },
  16: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        isLoading: false,
      },
    }
  },
  17: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        isFirstTime: true,
      },
    }
  },
  18: (state: RootState) => {
    return {
      ...state,
      // @ts-ignore
      bible: {
        // @ts-ignore
        ...state.bible,
        parallelVersions: [],
      },
    }
  },
  19: (state: RootState) => {
    return {
      ...state,
      plan: {
        ...state.plan,
        onlineStatus: 'Idle',
      },
    }
  },
  20: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          strongsHebreu: {},
          strongsGrec: {},
          words: {},
          naves: {},
        },
      },
    }
  },
  21: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        subscription: undefined,
      },
      // @ts-ignore
      bible: {
        // @ts-ignore
        ...state.bible,
        selectionMode: 'grid',
      },
    }
  },
  22: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            colors: {
              ...state.user.bible.settings.colors,
              black: blackColors,
            },
          },
        },
      },
    }
  },
  23: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            colors: {
              ...state.user.bible.settings.colors,
              sepia: sepiaColors,
            },
          },
        },
      },
    }
  },
  24: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            preferredColorScheme: 'auto',
            preferredLightTheme: 'default',
            preferredDarkTheme: 'dark',
            colors: {
              ...state.user.bible.settings.colors,
              nature: natureColors,
              sunset: sunsetColors,
              mauve: mauveColors,
              night: nightColors,
            },
          },
        },
        quota: {
          bibleSearch: {
            remaining: 10,
            lastDate: 0,
          },
          timelineSearch: {
            remaining: 10,
            lastDate: 0,
          },
          translateComments: {
            remaining: 10,
            lastDate: 0,
          },
        },
      },
    } as RootState
  },
  25: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        isLoading: true,
      },
    }
  },
  26: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        lastSeen: undefined,
      },
    }
  },
  // @ts-ignore - Remove 'bible' from state (where all the bible selectors state were)
  27: ({ bible, ...state }: RootState) => {
    return state
  },
  28: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            shareVerses: {
              hasVerseNumbers: true,
              hasInlineVerses: true,
              hasQuotes: true,
              hasAppName: true,
            },
          },
        },
      },
    }
  },
  29: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            lineHeight: 'normal',
          },
        },
      },
    }
  },
  30: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            customHighlightColors: [],
            defaultColorNames: {},
          },
        },
      },
    }
  },
  31: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          wordAnnotations: state.user.bible.wordAnnotations ?? {},
        },
      },
    }
  },
  32: (state: RootState) => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          settings: {
            ...state.user.bible.settings,
            redWordsDisplay: true,
          },
        },
      },
    }
  },
}
