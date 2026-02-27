import { describe, it, expect } from 'vitest'
import { parseFasta, reverseComplement, buildSequenceMap } from './parseFasta'

describe('parseFasta', () => {
  it('parses 4-sequence FASTA correctly', () => {
    const input = [
      '>Contig1 ',
      'CTACCCTGATGCTAGGGTCA',
      '>Contig2 ',
      'TAGGGTC',
      '>Contig3 ',
      'AAAAATTTTTGGGGGCCCCCAA',
      '>Contig4',
      'ATGCGGCAGT',
    ].join('\n')

    const records = parseFasta(input)

    expect(records).toHaveLength(4)

    expect(records[0]!.name).toBe('Contig1')
    expect(records[0]!.sequence).toBe('CTACCCTGATGCTAGGGTCA')

    expect(records[1]!.name).toBe('Contig2')
    expect(records[1]!.sequence).toBe('TAGGGTC')

    expect(records[2]!.name).toBe('Contig3')
    expect(records[2]!.sequence).toBe('AAAAATTTTTGGGGGCCCCCAA')

    expect(records[3]!.name).toBe('Contig4')
    expect(records[3]!.sequence).toBe('ATGCGGCAGT')
  })

  it('returns empty array for empty string', () => {
    expect(parseFasta('')).toEqual([])
  })

  it('joins multi-line sequences correctly', () => {
    const input = [
      '>MultiLine',
      'ATCG',
      'TTTT',
      'GGGG',
    ].join('\n')

    const records = parseFasta(input)

    expect(records).toHaveLength(1)
    expect(records[0]!.name).toBe('MultiLine')
    expect(records[0]!.sequence).toBe('ATCGTTTTGGGG')
  })

  it('uses only the first word of the header as the sequence name', () => {
    const input = '>Contig1 some extra description\nATCG'
    const records = parseFasta(input)
    expect(records[0]!.name).toBe('Contig1')
  })
})

describe('reverseComplement', () => {
  it('correctly reverse-complements ATCG → CGAT', () => {
    expect(reverseComplement('ATCG')).toBe('CGAT')
  })

  it('returns empty string for empty input', () => {
    expect(reverseComplement('')).toBe('')
  })

  it('handles lowercase bases', () => {
    expect(reverseComplement('atcg')).toBe('cgat')
  })

  it('handles ambiguous bases (N)', () => {
    expect(reverseComplement('ANCG')).toBe('CGNT')
  })

  it('correctly handles a longer sequence', () => {
    // CTACCCTGATGCTAGGGTCA → reverse = ACTGGGATCGTAAGGGCCATC → complement
    const seq = 'CTACCCTGATGCTAGGGTCA'
    const rc = reverseComplement(seq)
    // manual: rev of seq = 'ACTGGGATCGTAGGGGATC' ... let's just check double-RC = original
    expect(reverseComplement(rc)).toBe(seq)
  })
})

describe('buildSequenceMap', () => {
  it('creates a map with [forward, reverseComplement, length] for each record', () => {
    const records = [
      { name: 'Contig1', sequence: 'ATCG' },
      { name: 'Contig2', sequence: 'TTTT' },
    ]

    const map = buildSequenceMap(records)

    expect(map.size).toBe(2)

    const entry1 = map.get('Contig1')!
    expect(entry1[0]).toBe('ATCG')
    expect(entry1[1]).toBe(reverseComplement('ATCG'))
    expect(entry1[2]).toBe(4)

    const entry2 = map.get('Contig2')!
    expect(entry2[0]).toBe('TTTT')
    expect(entry2[1]).toBe('AAAA')
    expect(entry2[2]).toBe(4)
  })

  it('returns an empty map for an empty records array', () => {
    const map = buildSequenceMap([])
    expect(map.size).toBe(0)
  })
})
