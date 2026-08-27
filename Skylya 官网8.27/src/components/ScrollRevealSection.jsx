import useReveal from './useReveal'

export default function ScrollRevealSection({ as: Tag = 'section', className = '', children, ...props }) {
  const ref = useReveal({ forceVisible: false, stagger: true, step: 105, pointerReveal: true })

  return (
    <Tag ref={ref} className={`reveal warm-scroll-reveal ${className}`} {...props}>
      {children}
    </Tag>
  )
}
