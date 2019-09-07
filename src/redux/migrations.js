import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'

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
            press: 'shortPress'
          }
        }
      }
    }
  },
  1: state => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          changelog: {}
        }
      }
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
            notesDisplay: 'inline'
          }
        }
      }
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
          tags: {}
        }
      }
    }
  },
  4: state => {
    return {
      ...state,
      user: {
        ...state.user,
        id: ''
      }
    }
  },
  5: state => {
    return {
      ...state,
      bible: {
        ...state.bible,
        strongDatabaseHash: '',
        dictionnaireDatabaseHash: ''
      }
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
              dark: darkColors
            }
          }
        }
      }
    }
  },
  7: state => {
    return {
      ...state,
      user: {
        ...state.user,
        bible: {
          ...state.user.bible,
          history: []
        }
      }
    }
  }
}
