import { AiOutlineLine, AiOutlineLink } from 'react-icons/ai'
import { FiBox } from 'react-icons/fi'

const Toolbar = () => {
  return (
    <div id="toolbar">
      <span className="ql-formats">
        <select
          className="ql-header"
          defaultValue={''}
          onChange={(e) => e.persist()}
        >
          <option />
          <option value="1" />
          <option value="2" />
        </select>
      </span>
      <span className="ql-formats">
        <button className="ql-bold" />
        <button className="ql-italic" />
        <button className="ql-underline" />
      </span>
      <span className="ql-formats">
        <button className="ql-list" value="ordered"></button>
        <button className="ql-list" value="bullet"></button>
      </span>
      <span className="ql-formats">
        <select className="ql-color"></select>
        <select className="ql-background"></select>
      </span>
      <span className="ql-formats rounded-full bg-violet-50">
        <button className="ql-inlineVerse" title="Insérer un lien verset" aria-label="Lien verset"><AiOutlineLink className="size-[18px] text-violet-600" /></button>
        <button className="ql-bibleVerse" title="Insérer un bloc verset" aria-label="Bloc verset"><FiBox className="size-[18px] text-violet-600" /></button>
      </span>

      <span className="ql-formats rounded-full bg-blue-50">
        <button className="ql-inlineStrong" title="Insérer un lien strong" aria-label="Lien strong"><AiOutlineLink className="size-[18px] text-primary" /></button>
        <button className="ql-bibleStrong" title="Insérer un bloc strong" aria-label="Bloc strong"><FiBox className="size-[18px] text-primary" /></button>
      </span>

      <span className="ql-formats">
        <button className="ql-divider">
          <AiOutlineLine className="size-[18px]" />
        </button>
      </span>
    </div>
  )
}

export default Toolbar
