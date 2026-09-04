export const UserRecord = {
  bible: {
    highlights: {},
    notes: {},
    tags: {},
    history: [],
    strongsHebreu: {},
    strongsGrec: {},
    words: {},
    naves: {},
    settings: {
      alignContent: 'justify',
      fontSizeScale: 0,
      textDisplay: 'inline',
      theme: 'default',
      press: 'longPress',
      notesDisplay: 'inline',
      commentsDisplay: false,
      colors: {},
      compare: {
        ['LSG']: true,
      },
    },
  },
}

export interface User {
  id: string
  email: string
  displayName: string
  photoURL: string
  provider: string
  lastSeen: number
  subscription?: string
  emailVerified: boolean
  isLoading: boolean
  notifications: {
    verseOfTheDay: string
    notificationId: string
  }
  changelog: {
    isLoading: boolean
    lastSeen: number
    data: any[]
  }
  needsUpdate: {
    [x: string]: boolean
  }
  fontFamily: string
  bible: {
    changelog: {}
    highlights: {
      [x: string]: {
        color: string
        tags: {
          [x: string]: { id: string; name: string }
        }
        date: number
      }
    }
    notes: {}
    tags?: {
      [x: string]: FullTag
    }
    history: any[]
    strongsHebreu: {}
    strongsGrec: {}
    words: {}
    naves: {}
    settings: {
      alignContent: string
      fontSizeScale: number
      textDisplay: string
      theme: 'default' | 'dark' | 'black' | 'sepia'
      press: string
      notesDisplay: string
      commentsDisplay: boolean
      colors: {
        default: any
        dark: any
        black: any
        sepia: any
      }
      compare: {
        [x: string]: boolean
      }
    }
  }
}

export interface Delta {
  ops: {
    insert: string
    attributes: {
      [x: string]: any
    }
  }[]
}

export interface QuillVerseBlockProps {
  title: string
  verses: string[]
  version: string
  content: string
}

export interface HistoryItem {
  id: string
  modified_at: number
  content: Delta
}
export interface Study {
  id: string
  title: string
  created_at: number
  modified_at: number
  content?: Delta
  history?: HistoryItem[]
  published?: boolean
  user: {
    displayName: string
    id: string
    photoUrl: string
  }
  tags?: {
    [x: string]: Tag
  }
}

export interface FullTag {
  date: number
  id: string
  name: string
  studies?: { [x: string]: true }
  highlights?: { [x: string]: true }
  notes?: { [x: string]: true }
  naves?: { [x: string]: true }
  strongsGrec?: { [x: string]: true }
  strongsHebreu?: { [x: string]: true }
  words?: { [x: string]: true }
}

export interface Tag {
  id: string
  name: string
}

export interface LexiqueHit {
  Code: number
  Definition: string
  Mot: string
  LSG: string
  Phonetique: string
  Grec?: string
  Hebreu: string
  Origine: string
  Type: string
}

export interface Book {
  Numero: number
  Nom: string
  Chapitres: number
}
