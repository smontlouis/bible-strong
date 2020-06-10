import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import blackColors from '~themes/blackColors'
import sepiaColors from '~themes/sepiaColors'

export default {
  // Added 'press' in 'settings'
  0: state => {
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
  1: state => {
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
  2: state => {
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
  3: state => {
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
  4: state => {
    return {
      ...state,
      user: {
        ...state.user,
        id: '',
      },
    }
  },
  5: state => {
    return {
      ...state,
      bible: {
        ...state.bible,
      },
    }
  },
  6: state => {
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
  7: state => {
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
  8: state => {
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
  9: state => {
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
  10: state => {
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
  11: state => {
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
  12: state => {
    return {
      ...state,
      bible: {
        ...state.bible,
      },
    }
  },
  13: state => {
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
  14: state => {
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
  15: state => {
    return {
      ...state,
      user: {
        ...state.user,
        fontFamily: '',
      },
    }
  },
  16: state => {
    return {
      ...state,
      user: {
        ...state.user,
        isLoading: false,
      },
    }
  },
  17: state => {
    return {
      ...state,
      user: {
        ...state.user,
        isFirstTime: true,
      },
    }
  },
  18: state => {
    return {
      ...state,
      bible: {
        ...state.bible,
        parallelVersions: [],
      },
    }
  },
  19: state => {
    return {
      ...state,
      plan: {
        ...state.plan,
        onlineStatus: 'Idle',
      },
    }
  },
  20: state => {
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
  21: state => {
    return {
      ...state,
      user: {
        ...state.user,
        subscription: undefined,
      },
      bible: {
        ...state.bible,
        selectionMode: 'grid',
      },
    }
  },
  22: state => {
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
  23: state => {
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
}
