import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html'
import { firestore } from '../../lib/firebase'
import {
  getStudyEntityInlineAttributes,
  getStudyEntityInlineClasses,
  renderStudyEntityBlock,
} from './study-entities'
// import generateMetaImage from '../../helpers/generateMetaImage'

export interface FirebaseStudy {
  id: string
  title: string
  created_at: number
  modified_at: number
  published?: boolean
  content: { ops: any[] }
  tags: { [x: string]: { id: string; name: string } }
  user: {
    id: string
    displayName: string
    photoUrl: string
  }
}

export type OpsInlineType = 'inline-strong' | 'inline-verse'

export interface OpsInlineStrong {
  type: 'inline-strong'
  Type: string
  Grec: string
  Hebreu: string
  Mot: string
  Origine: string
  Phonetique: string
  LSG: string
  Definition: string
  Code: number
}

export interface OpsInlineVerse {
  id: string
  type: 'inline-verse'
  title: string
  verses: {
    id: string
    book: number
    chapter: number
    verse: number
    content: string
  }[]
}

export type OpsInline = OpsInlineStrong | OpsInlineVerse

export type Annexe = OpsInline[]

export interface StudyPageData extends FirebaseStudy {
  html: string
  annexe: Annexe
  imageUrl: string
  whatsappImageUrl: string
  updatedAt: number
}

export const convertStudyOpsToHtml = (ops: any[] = []): string => {
  const converter = new QuillDeltaToHtmlConverter(ops, {
    customTag: format => {
      if (
        format === 'inline-verse' ||
        format === 'inline-strong' ||
        format === 'inline-entity'
      ) {
        return format === 'inline-entity' ? 'button' : 'a'
      }
    },
    //@ts-ignore quill-delta-to-html does not expose custom blot attribute types
    customTagAttributes: op => {
      if (op.attributes?.['inline-entity']) {
        return getStudyEntityInlineAttributes(op)
      }
      if (op.attributes['inline-verse']) {
        return {
          title: op.attributes['inline-verse'].title,
          ['data-title']: op.attributes['inline-verse'].title,
          ['data-verses']: op.attributes['inline-verse'].verses,
        }
      }
      if (op.attributes['inline-strong']) {
        return {
          title: op.attributes['inline-strong'].title,
          ['data-code']: op.attributes['inline-strong'].codeStrong,
          ['data-title']: op.attributes['inline-strong'].title,
          ['data-book']: op.attributes['inline-strong'].book,
        }
      }
      return { title: '' }
    },
    customCssClasses: op => {
      if (op.attributes?.['inline-entity']) {
        return getStudyEntityInlineClasses(op)
      }
      if (op.attributes['inline-verse']) return ['inline-verse']
      if (op.attributes['inline-strong']) return ['inline-strong']
    },
  })

  converter.renderCustomWith(customOp => {
    if (customOp.insert.type === 'block-verse') {
      return `
      <div class="block-verse" data-verses="${customOp.insert.value.verses}">
        <div class="block-verse__content">${customOp.insert.value.content}</div>
        <div class="block-verse__aside">${customOp.insert.value.title} ${customOp.insert.value.version}</div>
      </div>`
    }

    if (customOp.insert.type === 'block-strong') {
      return `
    <div class="block-strong" data-code="${customOp.insert.value.codeStrong}" data-book="${customOp.insert.value.book}">
    <div class="block-strong__container">
      <div class="block-strong__title">${customOp.insert.value.title}</div>
      <div class="block-strong__phonetique">${customOp.insert.value.phonetique}</div>
      <div class="block-strong__original">${customOp.insert.value.original}</div>
    </div>
      <div class="block-strong__definition">
        ${customOp.insert.value.definition}
      </div>
    </div>`
    }

    if (customOp.insert.type === 'block-entity') {
      return renderStudyEntityBlock(customOp.insert.value)
    }

    if (customOp.insert.type === 'divider') return '<div class="divider"></div>'

    return `<div>${customOp.insert.type}</div>`
  })

  return converter.convert()
}

export const getStudy = async (id: string): Promise<StudyPageData | null> => {
  const snapshot = await firestore
    .collection('studies')
    .doc(id)
    .get()

  let result = snapshot.data() as unknown as FirebaseStudy

  if (!result?.published) {
    return null
  }

  const annexe = (
    await Promise.all(
      result.content?.ops.map(async (op, idx) => {
        if (op.insert?.['block-strong']) {
          const { book, codeStrong } = op.insert['block-strong']
          const isGrec = book > 39

          const doc = await firestore
            .collection(isGrec ? 'grec' : 'hebreu')
            .doc(codeStrong.toString())
            .get()
          const res = doc.exists ? doc.data() : undefined
          if (result.content) {
            result.content.ops[idx].insert['block-strong'].definition =
              res?.Definition
          }
        }
        if (op.attributes?.['inline-verse']) {
          let verses: string[] = op.attributes['inline-verse'].verses
          const title: string = op.attributes['inline-verse'].title

          try {
            verses = JSON.parse(verses as unknown as string)
          } catch {}

          const result = await Promise.all(
            verses.map(async (verse) => {
              const doc = await firestore
                .collection('bible-lsg-1910')
                .doc(verse)
                .get()
              return doc.exists ? doc.data() : undefined
            })
          )

          return <OpsInlineVerse>{
            type: 'inline-verse',
            id: verses.toString(),
            title,
            verses: result,
          }
        }

        if (op.attributes?.['inline-strong']) {
          const { book, codeStrong } = op.attributes['inline-strong']
          const isGrec = book > 39

          const doc = await firestore
            .collection(isGrec ? 'grec' : 'hebreu')
            .doc(codeStrong.toString())
            .get()
          const result = doc.exists ? doc.data() : undefined

          return <OpsInlineStrong>{
            type: 'inline-strong',
            ...result,
          }
        }
      }) || []
    )
  ).filter((value): value is OpsInline => Boolean(value))

  const html = convertStudyOpsToHtml(result.content?.ops)

  const { imageUrl, whatsappImageUrl } = { imageUrl: '', whatsappImageUrl: '' }
  // await generateMetaImage(
  //   result.id,
  //   result.title,
  //   result.user.displayName
  // )

  const res = {
    ...result,
    imageUrl,
    whatsappImageUrl,
    html,
    annexe,
  }

  return { ...res, updatedAt: Date.now() }
}
