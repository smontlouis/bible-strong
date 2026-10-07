/** An alphabet to browse a list by; a letter without entries is shown but not linked. */
export default function LetterNav({
  letters,
  available,
  current,
  hrefFor,
  label,
}: {
  letters: readonly string[]
  available: readonly string[]
  current?: string
  hrefFor: (letter: string) => string
  label: string
}) {
  return (
    <nav aria-label={label}>
      <ul className="strong-letters">
        {letters.map(letter => (
          <li key={letter}>
            {available.includes(letter) ? (
              <a
                className="strong-letters__letter"
                aria-current={letter === current ? 'page' : undefined}
                href={hrefFor(letter)}
              >
                {letter.toUpperCase()}
              </a>
            ) : (
              <span className="strong-letters__letter" aria-hidden="true">
                {letter.toUpperCase()}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
