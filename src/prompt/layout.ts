import type { ParagraphLayout, ReadingLine } from './position.ts'

/** Measure paragraph bounds once; lazily map characters only in paragraphs
 * being read. No DOM measurement is needed in the animation frame loop. */
export function measurePromptLayout(track: HTMLElement): ParagraphLayout[] {
  const trackTop = track.getBoundingClientRect().top
  return Array.from(track.querySelectorAll<HTMLParagraphElement>('p[data-block-id]')).map((element) => {
    const bounds = element.getBoundingClientRect()
    const text = element.firstChild
    const textLength = element.textContent?.length ?? 0
    let cachedLines: ReadingLine[] | null = null
    return {
      id: element.dataset.blockId!,
      top: bounds.top - trackTop,
      bottom: bounds.bottom - trackTop,
      textLength,
      lines: () => {
        if (cachedLines) return cachedLines
        cachedLines = []
        if (!text || !textLength) return cachedLines
        const range = element.ownerDocument.createRange()
        const currentTrackTop = track.getBoundingClientRect().top
        const characterRect = (offset: number) => {
          range.setStart(text, offset)
          range.setEnd(text, Math.min(textLength, offset + 1))
          return range.getBoundingClientRect()
        }
        let start = 0
        while (start < textLength) {
          const rect = characterRect(start)
          let low = start + 1
          let high = textLength
          while (low < high) {
            const middle = Math.floor((low + high) / 2)
            if (characterRect(middle).top <= rect.top + 1) low = middle + 1
            else high = middle
          }
          cachedLines.push({
            start, end: low,
            top: rect.top - currentTrackTop,
            bottom: rect.bottom - currentTrackTop,
          })
          start = low
        }
        return cachedLines
      },
    }
  })
}
