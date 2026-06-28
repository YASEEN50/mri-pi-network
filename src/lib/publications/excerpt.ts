/** Plain-text preview for publication cards (summary or start of content). */
export function publicationExcerpt(
  summary: string | null | undefined,
  content: string | null | undefined,
  maxChars = 220,
): string {
  const source = summary?.trim() || content?.trim() || ''
  if (!source) return ''

  const plain = source
    .replace(/[#*_`>\[\]()!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (plain.length <= maxChars) return plain
  const cut = plain.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  const trimmed = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${trimmed}…`
}

export function hasPublicationBody(
  summary: string | null | undefined,
  content: string | null | undefined,
): boolean {
  return Boolean(summary?.trim() || content?.trim())
}
