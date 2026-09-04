import type { Annexe as AnnexeProps } from './helpers.study'

interface Props {
  annexe: AnnexeProps
}
const Annexe = ({ annexe }: Props) => {
  return (
    <div>
      {annexe.map((item, idx) => {
        if (item.type === 'inline-strong') {
          const {
            // Type,
            // Grec,
            // Hebreu,
            // Origine,
            // Phonetique,
            // LSG,
            Mot,
            Definition,
            Code,
          } = item
          return (
            <div className="mb-10 flex" key={Code}>
              <div className="mr-3 text-primary">[{idx + 1}]</div>
              <div data-annexe={Code}>
                <p data-title className="mb-1">
                  {Mot}
                </p>
                <div
                  data-content
                  dangerouslySetInnerHTML={{ __html: Definition }}
                ></div>
              </div>
            </div>
          )
        }

        if (item.type === 'inline-verse') {
          const { title, verses, id } = item
          return (
            <div className="mb-10 flex" key={title}>
              <div className="mr-3 text-primary">[{idx + 1}]</div>
              <div data-annexe={id}>
                <p data-title className="mb-1">
                  {title}
                </p>
                <p data-content>
                  {verses.map((v) => (
                    <span key={v.id}>{v.content}</span>
                  ))}
                </p>
              </div>
            </div>
          )
        }
      })}
    </div>
  )
}

export default Annexe
