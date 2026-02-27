import { describe, it, expect } from 'vitest'
import {
  findParalogGenes,
  buildGeneContigMap,
  buildContigGeneMap,
  filterHits,
} from './filterAlignments'
import type { PafHit, SequenceMap } from './types'

/** Helper to create a minimal PafHit */
function makeHit(
  queryName: string,
  targetName: string,
  residueMatches = 150,
  mapq = 60,
  strand: '+' | '-' = '+',
): PafHit {
  return {
    queryName,
    queryLength: 200,
    queryStart: 0,
    queryEnd: 200,
    strand,
    targetName,
    targetLength: 200,
    targetStart: 0,
    targetEnd: 200,
    residueMatches,
    alignmentLength: 200,
    mapq,
  }
}

// Simulate assembly_4_sequences.fa vs pan_genome_reference.fa alignment
// gene1 → Contig1, gene2 → Contig2, gene3 → Contig3, gene4 → Contig4
// paralog_gene → Contig1, Contig2, Contig3 (3 contigs → paralog)
const SAMPLE_HITS: PafHit[] = [
  makeHit('Contig1', 'gene1'),
  makeHit('Contig2', 'gene2'),
  makeHit('Contig3', 'gene3'),
  makeHit('Contig4', 'gene4'),
  makeHit('Contig1', 'paralog_gene', 120),
  makeHit('Contig2', 'paralog_gene', 110),
  makeHit('Contig3', 'paralog_gene', 100),
]

// SequenceMap for all 4 contigs (values are [forward, revcomp, length])
const SEQUENCE_MAP: SequenceMap = new Map([
  ['Contig1', ['CTACCCTGATGCTAGGGTCA', 'TGACCCTAGCATCAGGGTAG', 20]],
  ['Contig2', ['TAGGGTC', 'GACCCTA', 7]],
  ['Contig3', ['AAAAATTTTTGGGGGCCCCCAA', 'TTGGGGGCCCCCAAAAATTTTT', 22]],
  ['Contig4', ['ATGCGGCAGT', 'ACTGCCGCAT', 10]],
])

describe('findParalogGenes', () => {
  it('identifies genes that hit 3 or more contigs as paralogs', () => {
    const paralogs = findParalogGenes(SAMPLE_HITS)
    expect(paralogs.has('paralog_gene')).toBe(true)
  })

  it('does not flag genes hitting fewer than 3 contigs as paralogs', () => {
    const paralogs = findParalogGenes(SAMPLE_HITS)
    expect(paralogs.has('gene1')).toBe(false)
    expect(paralogs.has('gene2')).toBe(false)
    expect(paralogs.has('gene3')).toBe(false)
    expect(paralogs.has('gene4')).toBe(false)
  })

  it('returns empty set when no paralogs exist', () => {
    const hits = [makeHit('Contig1', 'gene1'), makeHit('Contig2', 'gene2')]
    const paralogs = findParalogGenes(hits)
    expect(paralogs.size).toBe(0)
  })

  it('correctly counts hits to same contig multiple times as one unique contig', () => {
    const hits = [
      makeHit('Contig1', 'repeated_gene'),
      makeHit('Contig1', 'repeated_gene'),
      makeHit('Contig2', 'repeated_gene'),
    ]
    // Only 2 distinct contigs → not a paralog
    const paralogs = findParalogGenes(hits)
    expect(paralogs.has('repeated_gene')).toBe(false)
  })
})

describe('buildGeneContigMap', () => {
  it('maps each non-paralog gene to its contig', () => {
    const paralogs = findParalogGenes(SAMPLE_HITS)
    const geneContigMap = buildGeneContigMap(SAMPLE_HITS, paralogs)

    expect(geneContigMap.get('gene1')).toBe('Contig1')
    expect(geneContigMap.get('gene2')).toBe('Contig2')
    expect(geneContigMap.get('gene3')).toBe('Contig3')
    expect(geneContigMap.get('gene4')).toBe('Contig4')
  })

  it('excludes paralog genes from the map', () => {
    const paralogs = findParalogGenes(SAMPLE_HITS)
    const geneContigMap = buildGeneContigMap(SAMPLE_HITS, paralogs)
    expect(geneContigMap.has('paralog_gene')).toBe(false)
  })

  it('keeps only the best hit (highest residueMatches) when a gene maps to same contig multiple times', () => {
    const hits = [
      makeHit('Contig1', 'geneX', 80),
      makeHit('Contig1', 'geneX', 150),
    ]
    const geneContigMap = buildGeneContigMap(hits, new Set())
    expect(geneContigMap.get('geneX')).toBe('Contig1')
    expect(geneContigMap.size).toBe(1)
  })

  it('returns empty map when all genes are paralogs', () => {
    const allParalogHits = [
      makeHit('Contig1', 'para'),
      makeHit('Contig2', 'para'),
      makeHit('Contig3', 'para'),
    ]
    const paralogs = findParalogGenes(allParalogHits)
    const geneContigMap = buildGeneContigMap(allParalogHits, paralogs)
    expect(geneContigMap.size).toBe(0)
  })
})

describe('buildContigGeneMap', () => {
  it('initialises every contig from the SequenceMap with an array', () => {
    const paralogs = findParalogGenes(SAMPLE_HITS)
    const contigGeneMap = buildContigGeneMap(SAMPLE_HITS, SEQUENCE_MAP, paralogs)

    expect(contigGeneMap.has('Contig1')).toBe(true)
    expect(contigGeneMap.has('Contig2')).toBe(true)
    expect(contigGeneMap.has('Contig3')).toBe(true)
    expect(contigGeneMap.has('Contig4')).toBe(true)
  })

  it('assigns non-paralog genes to their corresponding contigs', () => {
    const paralogs = findParalogGenes(SAMPLE_HITS)
    const contigGeneMap = buildContigGeneMap(SAMPLE_HITS, SEQUENCE_MAP, paralogs)

    const genesOnContig1 = contigGeneMap.get('Contig1')!
    expect(genesOnContig1.some(g => g.name === 'gene1')).toBe(true)

    const genesOnContig2 = contigGeneMap.get('Contig2')!
    expect(genesOnContig2.some(g => g.name === 'gene2')).toBe(true)
  })

  it('does not include paralog genes in any contig list', () => {
    const paralogs = findParalogGenes(SAMPLE_HITS)
    const contigGeneMap = buildContigGeneMap(SAMPLE_HITS, SEQUENCE_MAP, paralogs)

    for (const genes of contigGeneMap.values()) {
      for (const gene of genes) {
        expect(gene.name).not.toBe('paralog_gene')
      }
    }
  })

  it('sets orientation to 1 for forward-strand hits', () => {
    const hits = [makeHit('Contig1', 'gene1', 150, 60, '+')]
    const contigGeneMap = buildContigGeneMap(hits, SEQUENCE_MAP, new Set())
    const genesOnContig1 = contigGeneMap.get('Contig1')!
    const gene1 = genesOnContig1.find(g => g.name === 'gene1')
    expect(gene1?.orientation).toBe(1)
  })

  it('sets orientation to -1 for reverse-strand hits', () => {
    const hits = [makeHit('Contig1', 'gene1', 150, 60, '-')]
    const contigGeneMap = buildContigGeneMap(hits, SEQUENCE_MAP, new Set())
    const genesOnContig1 = contigGeneMap.get('Contig1')!
    const gene1 = genesOnContig1.find(g => g.name === 'gene1')
    expect(gene1?.orientation).toBe(-1)
  })

  it('ignores hits for contigs not present in the SequenceMap', () => {
    const hits = [makeHit('UnknownContig', 'geneX')]
    const contigGeneMap = buildContigGeneMap(hits, SEQUENCE_MAP, new Set())
    expect(contigGeneMap.has('UnknownContig')).toBe(false)
  })
})

describe('filterHits', () => {
  it('keeps hits with mapq >= 20 and residueMatches >= 100', () => {
    const goodHit = makeHit('Contig1', 'gene1', 150, 60)
    const filtered = filterHits([goodHit])
    expect(filtered).toHaveLength(1)
  })

  it('removes hits with mapq < 20', () => {
    const lowMapqHit = makeHit('Contig1', 'gene1', 150, 10)
    const filtered = filterHits([lowMapqHit])
    expect(filtered).toHaveLength(0)
  })

  it('removes hits with residueMatches < 100', () => {
    const lowMatchHit = makeHit('Contig1', 'gene1', 50, 60)
    const filtered = filterHits([lowMatchHit])
    expect(filtered).toHaveLength(0)
  })

  it('removes hits failing both thresholds', () => {
    const badHit = makeHit('Contig1', 'gene1', 50, 10)
    const filtered = filterHits([badHit])
    expect(filtered).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(filterHits([])).toHaveLength(0)
  })

  it('filters multiple hits correctly', () => {
    const hits = [
      makeHit('Contig1', 'gene1', 150, 60),  // kept
      makeHit('Contig2', 'gene2', 80, 60),   // removed: low residueMatches
      makeHit('Contig3', 'gene3', 150, 15),  // removed: low mapq
      makeHit('Contig4', 'gene4', 120, 20),  // kept: exactly at threshold
    ]
    const filtered = filterHits(hits)
    expect(filtered).toHaveLength(2)
    expect(filtered[0]!.queryName).toBe('Contig1')
    expect(filtered[1]!.queryName).toBe('Contig4')
  })
})
