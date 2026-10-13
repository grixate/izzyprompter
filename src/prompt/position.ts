export type ReadingAnchor = { blockId: string; characterOffset: number }
export type ReadingLine = { start: number; end: number; top: number; bottom: number }
export type ParagraphLayout = {
  id: string
  top: number
  bottom: number
  textLength: number
  lines: () => ReadingLine[]
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function anchorAtPosition(paragraphs: ParagraphLayout[], position: number, readLine: number): ReadingAnchor | null {
  if (!paragraphs.length) return null
  const y = position + readLine
  let low = 0
  let high = paragraphs.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (paragraphs[middle].top <= y) low = middle
    else high = middle - 1
  }
  const paragraph = paragraphs[low]
  const lines = paragraph.lines()
  const line = lines.find((candidate) => candidate.bottom > y) ?? lines.at(-1)
  return { blockId: paragraph.id, characterOffset: line?.start ?? 0 }
}

export function positionAtAnchor(paragraphs: ParagraphLayout[], anchor: ReadingAnchor, readLine: number): number | null {
  const paragraph = paragraphs.find((candidate) => candidate.id === anchor.blockId)
  if (!paragraph) return null
  const offset = clamp(anchor.characterOffset, 0, paragraph.textLength)
  const lines = paragraph.lines()
  const line = lines.find((candidate) => offset < candidate.end) ?? lines.at(-1)
  return Math.max(0, (line ? (line.top + line.bottom) / 2 : paragraph.top) - readLine)
}
