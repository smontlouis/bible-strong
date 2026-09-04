import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'

type ViewerCard = 'strong' | 'note' | 'reference' | 'tag'

type ChapterCopy = {
  book: string
  version: string
  verses: string[]
  close: string
  openStudyItem: string
  cards: Record<ViewerCard, { eyebrow: string; title: string; body: string; meta: string }>
}

const chapterByLocale: Record<'fr' | 'en', ChapterCopy> = {
  fr: {
    book: 'Genèse 4',
    version: 'LSG',
    close: 'Fermer',
    openStudyItem: 'Ouvrir cet élément d’étude',
    cards: {
      strong: { eyebrow: 'H1893 · NOM PROPRE', title: 'הֶבֶל · Abel', body: 'Fils d’Adam et Ève. Son nom partage la forme hébraïque de hevel : souffle, vapeur, vanité.', meta: 'Lexique Strong' },
      note: { eyebrow: 'NOTE · GENÈSE 4.4', title: 'Un regard favorable', body: 'Hébreux 11.4 relit l’offrande d’Abel comme un acte de foi et fait dialoguer les deux passages.', meta: 'Note personnelle' },
      reference: { eyebrow: 'RÉFÉRENCE CROISÉE', title: 'Hébreux 11.4', body: 'C’est par la foi qu’Abel offrit à Dieu un sacrifice plus excellent que celui de Caïn.', meta: 'Relation biblique' },
      tag: { eyebrow: 'ÉTIQUETTE', title: 'Jalousie', body: 'Retrouvez les autres passages et annotations rattachés à ce thème dans votre bibliothèque.', meta: '3 passages liés' },
    },
    verses: [
      'Adam connut Ève, sa femme; elle conçut, et enfanta Caïn et elle dit: J’ai formé un homme avec l’aide de l’Éternel.',
      'Elle enfanta encore son frère Abel. Abel fut berger, et Caïn fut laboureur.',
      'Au bout de quelque temps, Caïn fit à l’Éternel une offrande des fruits de la terre;',
      'et Abel, de son côté, en fit une des premiers-nés de son troupeau et de leur graisse. L’Éternel porta un regard favorable sur Abel et sur son offrande;',
      'mais il ne porta pas un regard favorable sur Caïn et sur son offrande. Caïn fut très irrité, et son visage fut abattu.',
      'Et l’Éternel dit à Caïn: Pourquoi es-tu irrité, et pourquoi ton visage est-il abattu?',
      'Certainement, si tu agis bien, tu relèveras ton visage, et si tu agis mal, le péché se couche à la porte, et ses désirs se portent vers toi: mais toi, domine sur lui.',
      'Cependant, Caïn adressa la parole à son frère Abel; mais, comme ils étaient dans les champs, Caïn se jeta sur son frère Abel, et le tua.',
      'L’Éternel dit à Caïn: Où est ton frère Abel? Il répondit: Je ne sais pas; suis-je le gardien de mon frère?',
      'Et Dieu dit: Qu’as-tu fait? La voix du sang de ton frère crie de la terre jusqu’à moi.',
      'Maintenant, tu seras maudit de la terre qui a ouvert sa bouche pour recevoir de ta main le sang de ton frère.',
      'Quand tu cultiveras le sol, il ne te donnera plus sa richesse. Tu seras errant et vagabond sur la terre.',
      'Caïn dit à l’Éternel: Mon châtiment est trop grand pour être supporté.',
      'Voici, tu me chasses aujourd’hui de cette terre; je serai caché loin de ta face, je serai errant et vagabond sur la terre, et quiconque me trouvera me tuera.',
      'L’Éternel lui dit: Si quelqu’un tuait Caïn, Caïn serait vengé sept fois. Et l’Éternel mit un signe sur Caïn pour que quiconque le trouverait ne le tuât point.',
      'Puis, Caïn s’éloigna de la face de l’Éternel, et habita dans la terre de Nod, à l’orient d’Éden.',
      'Caïn connut sa femme; elle conçut, et enfanta Hénoc. Il bâtit ensuite une ville, et il donna à cette ville le nom de son fils Hénoc.',
      'Hénoc engendra Irad, Irad engendra Mehujaël, Mehujaël engendra Metuschaël, et Metuschaël engendra Lémec.',
      'Lémec prit deux femmes: le nom de l’une était Ada, et le nom de l’autre Tsilla.',
      'Ada enfanta Jabal: il fut le père de ceux qui habitent sous des tentes et près des troupeaux.',
      'Le nom de son frère était Jubal: il fut le père de tous ceux qui jouent de la harpe et du chalumeau.',
      'Tsilla, de son côté, enfanta Tubal-Caïn, qui forgeait tous les instruments d’airain et de fer. La sœur de Tubal-Caïn était Naama.',
      'Lémec dit à ses femmes: Ada et Tsilla, écoutez ma voix! Femmes de Lémec, écoutez ma parole! J’ai tué un homme pour ma blessure, et un jeune homme pour ma meurtrissure.',
      'Caïn sera vengé sept fois, et Lémec soixante-dix-sept fois.',
      'Adam connut encore sa femme; elle enfanta un fils, et l’appela du nom de Seth, car, dit-elle, Dieu m’a donné un autre fils à la place d’Abel, que Caïn a tué.',
      'Seth eut aussi un fils, et il l’appela du nom d’Énosch. C’est alors que l’on commença à invoquer le nom de l’Éternel.',
    ],
  },
  en: {
    book: 'Genesis 4',
    version: 'KJV',
    close: 'Close',
    openStudyItem: 'Open this study item',
    cards: {
      strong: { eyebrow: 'H1893 · PROPER NOUN', title: 'הֶבֶל · Abel', body: 'Son of Adam and Eve. His name shares the Hebrew form of hevel: breath, vapor, vanity.', meta: 'Strong’s lexicon' },
      note: { eyebrow: 'NOTE · GENESIS 4:4', title: 'The LORD had respect', body: 'Hebrews 11:4 reads Abel’s offering as an act of faith and connects the two passages.', meta: 'Personal note' },
      reference: { eyebrow: 'CROSS-REFERENCE', title: 'Hebrews 11:4', body: 'By faith Abel offered unto God a more excellent sacrifice than Cain.', meta: 'Bible relation' },
      tag: { eyebrow: 'TAG', title: 'Jealousy', body: 'Find every passage and annotation connected to this theme in your library.', meta: '3 linked passages' },
    },
    verses: [
      'And Adam knew Eve his wife; and she conceived, and bare Cain, and said, I have gotten a man from the LORD.',
      'And she again bare his brother Abel. And Abel was a keeper of sheep, but Cain was a tiller of the ground.',
      'And in process of time it came to pass, that Cain brought of the fruit of the ground an offering unto the LORD.',
      'And Abel, he also brought of the firstlings of his flock and of the fat thereof. And the LORD had respect unto Abel and to his offering:',
      'But unto Cain and to his offering he had not respect. And Cain was very wroth, and his countenance fell.',
      'And the LORD said unto Cain, Why art thou wroth? and why is thy countenance fallen?',
      'If thou doest well, shalt thou not be accepted? and if thou doest not well, sin lieth at the door. And unto thee shall be his desire, and thou shalt rule over him.',
      'And Cain talked with Abel his brother: and it came to pass, when they were in the field, that Cain rose up against Abel his brother, and slew him.',
      'And the LORD said unto Cain, Where is Abel thy brother? And he said, I know not: Am I my brother’s keeper?',
      'And he said, What hast thou done? the voice of thy brother’s blood crieth unto me from the ground.',
      'And now art thou cursed from the earth, which hath opened her mouth to receive thy brother’s blood from thy hand;',
      'When thou tillest the ground, it shall not henceforth yield unto thee her strength; a fugitive and a vagabond shalt thou be in the earth.',
      'And Cain said unto the LORD, My punishment is greater than I can bear.',
      'Behold, thou hast driven me out this day from the face of the earth; and from thy face shall I be hid; and I shall be a fugitive and a vagabond in the earth; and it shall come to pass, that every one that findeth me shall slay me.',
      'And the LORD said unto him, Therefore whosoever slayeth Cain, vengeance shall be taken on him sevenfold. And the LORD set a mark upon Cain, lest any finding him should kill him.',
      'And Cain went out from the presence of the LORD, and dwelt in the land of Nod, on the east of Eden.',
      'And Cain knew his wife; and she conceived, and bare Enoch: and he builded a city, and called the name of the city, after the name of his son, Enoch.',
      'And unto Enoch was born Irad: and Irad begat Mehujael: and Mehujael begat Methusael: and Methusael begat Lamech.',
      'And Lamech took unto him two wives: the name of the one was Adah, and the name of the other Zillah.',
      'And Adah bare Jabal: he was the father of such as dwell in tents, and of such as have cattle.',
      'And his brother’s name was Jubal: he was the father of all such as handle the harp and organ.',
      'And Zillah, she also bare Tubalcain, an instructor of every artificer in brass and iron: and the sister of Tubalcain was Naamah.',
      'And Lamech said unto his wives, Adah and Zillah, Hear my voice; ye wives of Lamech, hearken unto my speech: for I have slain a man to my wounding, and a young man to my hurt.',
      'If Cain shall be avenged sevenfold, truly Lamech seventy and sevenfold.',
      'And Adam knew his wife again; and she bare a son, and called his name Seth: For God, said she, hath appointed me another seed instead of Abel, whom Cain slew.',
      'And to Seth, to him also there was born a son; and he called his name Enos: then began men to call upon the name of the LORD.',
    ],
  },
}

function MiniIcon({ name }: { name: 'book' | 'file' | 'tag' | 'sound' | 'search' | 'home' | 'more' | 'close' }) {
  const paths = {
    book: <><path d="M3 5.5c3.2-1.2 6-.7 9 1.1v12c-3-1.8-5.8-2.3-9-1.1Z" /><path d="M21 5.5c-3.2-1.2-6-.7-9 1.1v12c3-1.8 5.8-2.3 9-1.1Z" /></>,
    file: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></>,
    tag: <><path d="m4 4 7-.5 9.5 9.5-7.5 7.5L3.5 11Z" /><circle cx="8" cy="8" r="1" /></>,
    sound: <><path d="M5 10h4l5-4v12l-5-4H5Z" /><path d="M17 9c1.5 1.5 1.5 4.5 0 6M19.5 6.5c3 3 3 8 0 11" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
    home: <><path d="m3 11 9-7 9 7" /><path d="M5.5 10v10h13V10M9.5 20v-6h5v6" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>
}

function StudyChip({ kind, label, onClick }: { kind: 'strong' | 'note' | 'reference' | 'tag'; label: string; onClick: () => void }) {
  const icon = kind === 'strong' ? 'א' : kind === 'note' ? <MiniIcon name="file" /> : kind === 'reference' ? <MiniIcon name="book" /> : <MiniIcon name="tag" />
  return <button className={`mini-bible-chip mini-bible-chip--${kind}`} type="button" onClick={onClick}><span>{icon}</span><b>{label}</b></button>
}

function LandingBibleViewerDemo({ locale }: { locale: string }) {
  const activeLocale = locale === 'fr' ? 'fr' : 'en'
  const copy = chapterByLocale[activeLocale]
  const [openCard, setOpenCard] = useState<ViewerCard | null>(null)
  const readerRef = useRef<HTMLDivElement>(null)
  const readerContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrapper = readerRef.current
    const content = readerContentRef.current
    if (!wrapper || !content) return

    const lenis = new Lenis({
      wrapper,
      content,
      eventsTarget: wrapper,
      autoRaf: true,
      lerp: 0.1,
      duration: 1.2,
      wheelMultiplier: 0.72,
      smoothWheel: true,
      overscroll: false,
      respectReducedMotion: true,
    })

    return () => lenis.destroy()
  }, [])

  const renderVerse = (verse: string, number: number) => {
    if (number === 2) {
      const [before, after] = verse.split('Abel.')
      return <>{before}<button className="mini-bible-mark mini-bible-mark--background" type="button" onClick={() => setOpenCard('strong')}>Abel.</button><StudyChip kind="strong" label={activeLocale === 'fr' ? 'vanité' : 'Abel'} onClick={() => setOpenCard('strong')} />{after}</>
    }

    if (number === 4) {
      const opening = activeLocale === 'fr' ? 'et Abel, de son côté, en fit une des ' : 'And Abel, he also brought of the '
      const underlined = activeLocale === 'fr' ? 'premiers-nés de son troupeau' : 'firstlings of his flock'
      const middle = activeLocale === 'fr' ? ' et de leur graisse. ' : ' and of the fat thereof. '
      const secondUnderline = activeLocale === 'fr' ? 'L’Éternel porta un regard favorable' : 'And the LORD had respect'
      const ending = activeLocale === 'fr' ? ' sur Abel et sur son offrande;' : ' unto Abel and to his offering:'
      return <>{opening}<span className="mini-bible-mark mini-bible-mark--underline">{underlined}</span>{middle}<span className="mini-bible-mark mini-bible-mark--aqua">{secondUnderline}</span>{ending}<StudyChip kind="note" label={activeLocale === 'fr' ? 'Hébreux dit que…' : 'Hebrews says…'} onClick={() => setOpenCard('note')} /><StudyChip kind="reference" label={activeLocale === 'fr' ? 'Hébreux 11.4' : 'Hebrews 11:4'} onClick={() => setOpenCard('reference')} /></>
    }

    if (number === 5) {
      const [before, rest = ''] = verse.split(activeLocale === 'fr' ? 'Caïn fut très irrité' : 'Cain was very wroth')
      const marked = activeLocale === 'fr' ? 'Caïn fut très irrité' : 'Cain was very wroth'
      return <>{before}<span className="mini-bible-mark mini-bible-mark--coral">{marked}</span>{rest}<StudyChip kind="tag" label={activeLocale === 'fr' ? 'Jalousie' : 'Jealousy'} onClick={() => setOpenCard('tag')} /><StudyChip kind="reference" label={activeLocale === 'fr' ? '1 Jean 3.12' : '1 John 3:12'} onClick={() => setOpenCard('reference')} /></>
    }

    return verse
  }

  const card = openCard ? copy.cards[openCard] : null

  return (
    <div className="mini-bible" lang={activeLocale}>
      <div className="mini-bible-status" aria-hidden="true"><b>9:41</b><i /><span>● ◒ ▰</span></div>
      <header className="mini-bible-header">
        <button type="button" title={copy.book}><strong>{copy.book}</strong><b>{copy.version}</b></button>
        <span className="mini-bible-strong-mark">S</span>
        <span className="mini-bible-menu">•••</span>
      </header>
      <div className="mini-bible-reader" ref={readerRef} tabIndex={0} aria-label={`${copy.book}, ${copy.version}`}>
        <div className="mini-bible-reader__content" ref={readerContentRef}>
          <p>
            {copy.verses.map((verse, index) => <span className="mini-bible-verse" key={index}><sup>{index + 1}</sup>{renderVerse(verse, index + 1)}{' '}</span>)}
          </p>
          <span className="mini-bible-end">{copy.book} · {copy.version}</span>
        </div>
      </div>
      <button className="mini-bible-audio" type="button" aria-label={activeLocale === 'fr' ? 'Écouter le chapitre' : 'Listen to the chapter'}><MiniIcon name="sound" /></button>
      <nav className="mini-bible-tabs" aria-hidden="true"><MiniIcon name="home" /><MiniIcon name="search" /><MiniIcon name="book" /><span>1</span><MiniIcon name="more" /></nav>
      {card && <div className="mini-bible-card-layer" role="dialog" aria-modal="true" aria-label={card.title} onClick={() => setOpenCard(null)}>
        <article className="mini-bible-card" onClick={(event) => event.stopPropagation()}>
          <button className="mini-bible-card__close" type="button" aria-label={copy.close} onClick={() => setOpenCard(null)}><MiniIcon name="close" /></button>
          <small>{card.eyebrow}</small><h3>{card.title}</h3><p>{card.body}</p><button className="mini-bible-card__action" type="button">{card.meta}<span aria-hidden="true">→</span><span className="sr-only">{copy.openStudyItem}</span></button>
        </article>
      </div>}
    </div>
  )
}

export default LandingBibleViewerDemo
