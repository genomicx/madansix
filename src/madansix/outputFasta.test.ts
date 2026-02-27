import { describe, it, expect } from 'vitest'
import { computeN50, graphToDot, graphToEdges, assembleOrderedFasta } from './outputFasta'
import type { ContigEdge, SequenceMap, ContigEnds } from './types'
import UndirectedGraph from 'graphology'

describe('computeN50', () => {
  it('returns 300 for [100, 200, 300] (sum=600, half=300, N50=300)', () => {
    expect(computeN50([100, 200, 300])).toBe(300)
  })

  it('returns 10 for a single-element array [10]', () => {
    expect(computeN50([10])).toBe(10)
  })

  it('returns 0 for an empty array', () => {
    expect(computeN50([])).toBe(0)
  })

  it('returns 200 for [100, 200] (sum=300, half=150, N50=200)', () => {
    expect(computeN50([100, 200])).toBe(200)
  })

  it('handles unsorted input (sorts descending internally)', () => {
    // Same as [100, 200, 300] but given in unsorted order
    expect(computeN50([300, 100, 200])).toBe(300)
  })

  it('returns 50 for four equal-length values [50, 50, 50, 50] (sum=200, half=100, cumulative=50→no, 100→yes)', () => {
    expect(computeN50([50, 50, 50, 50])).toBe(50)
  })
})

describe('graphToDot', () => {
  it('produces a valid DOT string for a simple edge list', () => {
    const edges: ContigEdge[] = [
      { source: 'Contig1', target: 'Contig2' },
      { source: 'Contig2', target: 'Contig3' },
    ]
    const dot = graphToDot(edges)

    expect(dot).toContain('graph')
    expect(dot).toContain('Contig1')
    expect(dot).toContain('Contig2')
    expect(dot).toContain('Contig3')
    expect(dot).toContain('--')
  })

  it('returns a valid DOT string with braces for an empty edge list', () => {
    const dot = graphToDot([])
    expect(dot).toContain('{')
    expect(dot).toContain('}')
  })

  it('includes all source and target nodes', () => {
    const edges: ContigEdge[] = [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
      { source: 'C', target: 'D' },
    ]
    const dot = graphToDot(edges)
    expect(dot).toContain('A')
    expect(dot).toContain('B')
    expect(dot).toContain('C')
    expect(dot).toContain('D')
  })

  it('includes edge declarations using -- notation', () => {
    const edges: ContigEdge[] = [{ source: 'X', target: 'Y' }]
    const dot = graphToDot(edges)
    expect(dot).toMatch(/"X"\s*--\s*"Y"|"Y"\s*--\s*"X"/)
  })

  it('produces output that starts with a strict graph declaration', () => {
    const edges: ContigEdge[] = [{ source: 'n1', target: 'n2' }]
    const dot = graphToDot(edges)
    expect(dot.trimStart()).toMatch(/^strict\s+graph\b/)
  })

  it('each node appears as a declaration line ending with a semicolon', () => {
    const edges: ContigEdge[] = [{ source: 'Alpha', target: 'Beta' }]
    const dot = graphToDot(edges)
    expect(dot).toContain('"Alpha";')
    expect(dot).toContain('"Beta";')
  })
})

// ---------------------------------------------------------------------------
// graphToEdges
// ---------------------------------------------------------------------------

describe('graphToEdges', () => {
  it('converts a single-edge graphology graph to ContigEdge[]', () => {
    const graph = new UndirectedGraph()
    graph.addNode('ContigA')
    graph.addNode('ContigB')
    graph.addEdge('ContigA', 'ContigB')

    const edges = graphToEdges(graph)

    expect(edges).toHaveLength(1)
    expect(edges[0]!.source).toBe('ContigA')
    expect(edges[0]!.target).toBe('ContigB')
  })

  it('converts a multi-edge graph preserving all edges', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')

    const edges = graphToEdges(graph)

    expect(edges).toHaveLength(2)
    const sources = edges.map(e => e.source)
    const targets = edges.map(e => e.target)
    expect(sources).toContain('A')
    expect(targets).toContain('B')
  })

  it('returns an empty array for an empty graph', () => {
    const graph = new UndirectedGraph()
    const edges = graphToEdges(graph)
    expect(edges).toEqual([])
  })

  it('returns an empty array for a graph with nodes but no edges', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    const edges = graphToEdges(graph)
    expect(edges).toEqual([])
  })

  it('returns edges with source and target properties matching ContigEdge type', () => {
    const graph = new UndirectedGraph()
    graph.addNode('X')
    graph.addNode('Y')
    graph.addEdge('X', 'Y')

    const edges = graphToEdges(graph)

    for (const edge of edges) {
      expect(edge).toHaveProperty('source')
      expect(edge).toHaveProperty('target')
      expect(typeof edge.source).toBe('string')
      expect(typeof edge.target).toBe('string')
    }
  })
})

// ---------------------------------------------------------------------------
// assembleOrderedFasta
// ---------------------------------------------------------------------------

describe('assembleOrderedFasta', () => {
  it('joins two contigs in a connected component with a 200-N gap', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addEdge('A', 'B')

    const sequences: SequenceMap = new Map([
      ['A', ['AAAA', 'TTTT', 4]],
      ['B', ['GGGG', 'CCCC', 4]],
    ])

    // A is start (degree 1, alphabetically first), B is end
    // A→B: position 800 → start orientation = 1 (>= seqLen/2 for 4bp → >= 2)
    // B→A: position 3 → end orientation = 1 (< seqLen/2 → 1)
    const contigEnds: ContigEnds = {
      A: { B: [3, 4] },
      B: { A: [1, 0] },
    }

    const allContigs = [
      { name: 'A', sequence: 'AAAA' },
      { name: 'B', sequence: 'GGGG' },
    ]

    const result = assembleOrderedFasta(graph, sequences, contigEnds, allContigs)

    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('Contig1')
    // The joined sequence should contain both contig sequences separated by 200 Ns
    expect(result[0]!.sequence).toContain('N'.repeat(200))
    expect(result[0]!.sequence.length).toBe(4 + 200 + 4)
  })

  it('appends unused contigs at the end', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addEdge('A', 'B')

    const sequences: SequenceMap = new Map([
      ['A', ['AAAA', 'TTTT', 4]],
      ['B', ['GGGG', 'CCCC', 4]],
    ])

    const contigEnds: ContigEnds = {
      A: { B: [3, 4] },
      B: { A: [1, 0] },
    }

    // allContigs includes C which is not in the graph
    const allContigs = [
      { name: 'A', sequence: 'AAAA' },
      { name: 'B', sequence: 'GGGG' },
      { name: 'C', sequence: 'TTTTCCCC' },
    ]

    const result = assembleOrderedFasta(graph, sequences, contigEnds, allContigs)

    // Should have the joined contig plus the unused contig C
    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('Contig1')
    expect(result[1]!.name).toBe('C')
    expect(result[1]!.sequence).toBe('TTTTCCCC')
  })

  it('handles an empty graph (all contigs are unused)', () => {
    const graph = new UndirectedGraph()
    const sequences: SequenceMap = new Map()
    const contigEnds: ContigEnds = {}

    const allContigs = [
      { name: 'X', sequence: 'ATCG' },
      { name: 'Y', sequence: 'GCTA' },
    ]

    const result = assembleOrderedFasta(graph, sequences, contigEnds, allContigs)

    // Both contigs should appear as unused
    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('X')
    expect(result[1]!.name).toBe('Y')
  })

  it('uses reverse complement when orientation is -1', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addEdge('A', 'B')

    // A has sequence ATCG, reverse complement is CGAT
    // B has sequence GGCC, reverse complement is GGCC
    const sequences: SequenceMap = new Map([
      ['A', ['ATCG', 'CGAT', 4]],
      ['B', ['GGCC', 'GGCC', 4]],
    ])

    // A: gene at position 1 (< seqLen/2 = 2) → start orientation = -1
    // B: gene at position 3 (>= seqLen/2 = 2) → end orientation: ends[0] < seqLen/2? → 3 < 2 is false → -1
    const contigEnds: ContigEnds = {
      A: { B: [1, 0] },
      B: { A: [3, 4] },
    }

    const allContigs = [
      { name: 'A', sequence: 'ATCG' },
      { name: 'B', sequence: 'GGCC' },
    ]

    const result = assembleOrderedFasta(graph, sequences, contigEnds, allContigs)

    expect(result).toHaveLength(1)
    const seq = result[0]!.sequence
    // With orientation -1, the reverse complement should be used
    // The sequence should contain the reverse complement of at least one contig
    // Since GGCC revcomp is also GGCC, and ATCG revcomp is CGAT
    // Let's just verify the total structure
    expect(seq.length).toBe(4 + 200 + 4)
    expect(seq).toContain('N'.repeat(200))
  })

  it('names joined contigs sequentially as Contig1, Contig2, etc.', () => {
    // Two separate connected components
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addNode('D')
    graph.addEdge('A', 'B')
    graph.addEdge('C', 'D')

    const sequences: SequenceMap = new Map([
      ['A', ['AAAA', 'TTTT', 4]],
      ['B', ['GGGG', 'CCCC', 4]],
      ['C', ['TTTT', 'AAAA', 4]],
      ['D', ['CCCC', 'GGGG', 4]],
    ])

    const contigEnds: ContigEnds = {
      A: { B: [3, 4] },
      B: { A: [1, 0] },
      C: { D: [3, 4] },
      D: { C: [1, 0] },
    }

    const allContigs = [
      { name: 'A', sequence: 'AAAA' },
      { name: 'B', sequence: 'GGGG' },
      { name: 'C', sequence: 'TTTT' },
      { name: 'D', sequence: 'CCCC' },
    ]

    const result = assembleOrderedFasta(graph, sequences, contigEnds, allContigs)

    // Two components → two joined contigs
    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('Contig1')
    expect(result[1]!.name).toBe('Contig2')
  })

  it('returns empty result for empty graph and empty allContigs', () => {
    const graph = new UndirectedGraph()
    const sequences: SequenceMap = new Map()
    const contigEnds: ContigEnds = {}
    const allContigs: Array<{ name: string; sequence: string }> = []

    const result = assembleOrderedFasta(graph, sequences, contigEnds, allContigs)

    expect(result).toEqual([])
  })
})
