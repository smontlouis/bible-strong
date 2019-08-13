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
  }
}
