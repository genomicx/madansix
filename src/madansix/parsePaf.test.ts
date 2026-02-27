import { describe, it, expect } from 'vitest'
import { parsePaf } from './parsePaf'

const SAMPLE_PAF_LINE =
  'Contig1\t20\t0\t18\t+\tgene1\t22\t2\t20\t17\t18\t60'

describe('parsePaf', () => {
  it('parses a valid PAF line with all 12 fields', () => {
    const hits = parsePaf(SAMPLE_PAF_LINE)

    expect(hits).toHaveLength(1)

    const hit = hits[0]!
    expect(hit.queryName).toBe('Contig1')
    expect(hit.queryLength).toBe(20)
    expect(hit.queryStart).toBe(0)
    expect(hit.queryEnd).toBe(18)
    expect(hit.strand).toBe('+')
    expect(hit.targetName).toBe('gene1')
    expect(hit.targetLength).toBe(22)
    expect(hit.targetStart).toBe(2)
    expect(hit.targetEnd).toBe(20)
    expect(hit.residueMatches).toBe(17)
    expect(hit.alignmentLength).toBe(18)
    expect(hit.mapq).toBe(60)
  })

  it('skips empty lines', () => {
    const input = `${SAMPLE_PAF_LINE}\n\n${SAMPLE_PAF_LINE}`
    const hits = parsePaf(input)
    expect(hits).toHaveLength(2)
  })

  it('skips lines with fewer than 12 tab-separated fields', () => {
    const shortLine = 'Contig1\t20\t0\t18\t+\tgene1'
    const hits = parsePaf(shortLine)
    expect(hits).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    const hits = parsePaf('')
    expect(hits).toHaveLength(0)
  })

  it('parses reverse-strand hit correctly', () => {
    const reverseLine =
      'Contig2\t7\t0\t7\t-\tgene2\t22\t0\t7\t7\t7\t40'
    const hits = parsePaf(reverseLine)
    expect(hits).toHaveLength(1)
    expect(hits[0]!.strand).toBe('-')
  })

  it('parses multiple valid lines', () => {
    const lines = [
      'Contig1\t20\t0\t18\t+\tgene1\t22\t2\t20\t17\t18\t60',
      'Contig2\t7\t0\t7\t-\tgene2\t22\t0\t7\t7\t7\t40',
      'Contig3\t22\t0\t22\t+\tgene3\t22\t0\t22\t20\t22\t55',
    ].join('\n')

    const hits = parsePaf(lines)
    expect(hits).toHaveLength(3)
    expect(hits[0]!.queryName).toBe('Contig1')
    expect(hits[1]!.queryName).toBe('Contig2')
    expect(hits[2]!.queryName).toBe('Contig3')
  })

  it('skips lines with invalid strand character', () => {
    const badStrandLine =
      'Contig1\t20\t0\t18\t?\tgene1\t22\t2\t20\t17\t18\t60'
    const hits = parsePaf(badStrandLine)
    expect(hits).toHaveLength(0)
  })
})
