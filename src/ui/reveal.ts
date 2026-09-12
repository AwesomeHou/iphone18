/* ==================================================================
   Scroll reveals.

   Content is visible by default and only becomes animated once JS has
   confirmed IntersectionObserver exists. A headless renderer, a
   background tab, or a browser that never fires the callback therefore
   ships a readable page rather than a blank one, which is the failure
   mode of the usual opacity-0-until-scrolled pattern.
   ================================================================== */

export function initReveal(reduced: boolean): () => void {
  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
  if (reduced || !('IntersectionObserver' in window) || targets.length === 0) {
    return () => {}
  }

  for (const el of targets) el.classList.add('is-revealing')

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed')
          io.unobserve(entry.target)
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
  )
  for (const el of targets) io.observe(el)

  // Belt and braces: whatever happens, nothing stays hidden for long.
  const safety = window.setTimeout(() => {
    for (const el of targets) el.classList.add('is-revealed')
  }, 2500)

  return () => {
    window.clearTimeout(safety)
    io.disconnect()
  }
}
