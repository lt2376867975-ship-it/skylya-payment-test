const LETTERS = ['S', 'k', 'y', 'l', 'y', 'a']

export default function SkylyaLogo({ className = '' }) {
  return (
    <span className={`skylya-logo ${className}`} aria-label="Skylya">
      {LETTERS.map((letter, index) => (
        <span key={`${letter}-${index}`} style={{ '--logo-i': index }} aria-hidden="true">
          {letter}
        </span>
      ))}
    </span>
  )
}
