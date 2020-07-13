export interface Comments {
  id: string // 1-1-1
  comments: (Comment | EGWComment)[]
}

export interface Comment {
  id: string
  verseId: string
  content: string
  resource: Resource
  order: number
  type: 'comment'
  href?: string
  isSDA: boolean
}

export interface EGWComment extends Omit<Comment, 'type'> {
  reference: string
  chapterTitle?: string
  sectionTitle?: string
  type: 'egw_comment'
  isSDA: true
}

export interface Resource {
  name: string
  code: string
  logo: string
  author: string
}
