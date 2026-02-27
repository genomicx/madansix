import type { PafHit } from './types'

/**
 * Parse PAF (Pairwise mApping Format) output from minimap2.
 *
 * PAF column layout (0-indexed):
 *  0  queryName
 *  1  queryLength
 *  2  queryStart
 *  3  queryEnd
 *  4  strand (+/-)
 *  5  targetName
 *  6  targetLength
 *  7  targetStart
 *  8  targetEnd
 *  9  residueMatches
 * 10  alignmentLength
 * 11  mapq
 *
 * In madansix: queryName = assembly contig, targetName = pan-genome gene.
 */
export function parsePaf(text: string): PafHit[] {
  const hits: PafHit[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    const cols = line.split('\t')
    if (cols.length < 12) continue

    const strand = cols[4]
    if (strand !== '+' && strand !== '-') continue

    const hit: PafHit = {
      queryName:       cols[0]!,
      queryLength:     parseInt(cols[1]!, 10),
      queryStart:      parseInt(cols[2]!, 10),
      queryEnd:        parseInt(cols[3]!, 10),
      strand,
      targetName:      cols[5]!,
      targetLength:    parseInt(cols[6]!, 10),
      targetStart:     parseInt(cols[7]!, 10),
      targetEnd:       parseInt(cols[8]!, 10),
      residueMatches:  parseInt(cols[9]!, 10),
      alignmentLength: parseInt(cols[10]!, 10),
      mapq:            parseInt(cols[11]!, 10),
    }

    // Skip lines where numeric parsing failed
    if (
      isNaN(hit.queryLength) || isNaN(hit.queryStart) || isNaN(hit.queryEnd) ||
      isNaN(hit.targetLength) || isNaN(hit.targetStart) || isNaN(hit.targetEnd) ||
      isNaN(hit.residueMatches) || isNaN(hit.alignmentLength) || isNaN(hit.mapq)
    ) {
      continue
    }

    hits.push(hit)
  }

  return hits
}
