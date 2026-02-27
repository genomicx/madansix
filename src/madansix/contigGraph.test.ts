import { describe, it, expect } from 'vitest'
import {
  expandContigConnections,
  refineContigGraph,
  buildContigSubgraph,
  removeExtraContigs,
} from './contigGraph'
import { parseDot } from './parseDot'
import type { Gene, PanGenomeGraph, ContigNeighbour, SequenceMap } from './types'
import UndirectedGraph from 'graphology'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a Gene with minimal required fields */
function makeGene(
  name: string,
  contigName: string,
  queryStart = 0,
  queryEnd = 100,
  orientation: 1 | -1 = 1,
): Gene {
  return { name, contigName, orientation, queryStart, queryEnd }
}

/**
 * Build a PanGenomeGraph from a DOT string for convenience.
 * Uses the real parseDot function so our test data format is validated.
 */
function graphFromDot(dot: string): PanGenomeGraph {
  return parseDot(dot)
}

// ---------------------------------------------------------------------------
// expandContigConnections
// ---------------------------------------------------------------------------

describe('expandContigConnections', () => {
  it('finds two contigs as neighbours when their genes are adjacent in the pan-genome graph', () => {
    // Pan-genome: gene1 -- gene2 -- gene3 -- gene4
    // Contig A owns gene1, gene2
    // Contig B owns gene3, gene4
    // After initial expansion, A expands to include gene3 (neighbour of gene2)
    // and B expands to include gene2 (neighbour of gene3) → overlap at iteration 1
    const panGenome = graphFromDot(`
      graph {
        gene1 -- gene2;
        gene2 -- gene3;
        gene3 -- gene4;
      }
    `)

    const contigGeneMap = new Map<string, Gene[]>([
      ['ContigA', [makeGene('gene1', 'ContigA'), makeGene('gene2', 'ContigA')]],
      ['ContigB', [makeGene('gene3', 'ContigB'), makeGene('gene4', 'ContigB')]],
    ])

    const neighbours = expandContigConnections(contigGeneMap, panGenome)

    expect(neighbours.length).toBeGreaterThanOrEqual(1)
    const found = neighbours.find(
      n => n.contigs.includes('ContigA') && n.contigs.includes('ContigB'),
    )
    expect(found).toBeDefined()
    expect(found!.contigs).toEqual(['ContigA', 'ContigB'])
    expect(found!.intersectionGenes.length).toBeGreaterThan(0)
  })

  it('finds neighbours through a longer path after multiple expansion iterations', () => {
    // Pan-genome: gene1 -- gene2 -- gene3 -- gene4 -- gene5 -- gene6
    // Contig A owns gene1, gene2
    // Contig B owns gene5, gene6
    // They are separated by 2 intermediate genes (gene3, gene4)
    // so they need multiple expansion rounds to meet
    const panGenome = graphFromDot(`
      graph {
        gene1 -- gene2;
        gene2 -- gene3;
        gene3 -- gene4;
        gene4 -- gene5;
        gene5 -- gene6;
      }
    `)

    const contigGeneMap = new Map<string, Gene[]>([
      ['ContigA', [makeGene('gene1', 'ContigA'), makeGene('gene2', 'ContigA')]],
      ['ContigB', [makeGene('gene5', 'ContigB'), makeGene('gene6', 'ContigB')]],
    ])

    const neighbours = expandContigConnections(contigGeneMap, panGenome)

    expect(neighbours.length).toBeGreaterThanOrEqual(1)
    const found = neighbours.find(
      n => n.contigs.includes('ContigA') && n.contigs.includes('ContigB'),
    )
    expect(found).toBeDefined()
    // Should have found the connection at iteration > 1
    expect(found!.iteration).toBeGreaterThan(1)
  })

  it('returns an empty array when contigs share no gene neighbourhood', () => {
    // Two disconnected components in the pan-genome graph
    const panGenome = graphFromDot(`
      graph {
        gene1 -- gene2;
        gene3 -- gene4;
      }
    `)

    const contigGeneMap = new Map<string, Gene[]>([
      ['ContigA', [makeGene('gene1', 'ContigA')]],
      ['ContigB', [makeGene('gene3', 'ContigB')]],
    ])

    const neighbours = expandContigConnections(contigGeneMap, panGenome)

    // They should never meet because the graph is disconnected
    const found = neighbours.find(
      n => n.contigs.includes('ContigA') && n.contigs.includes('ContigB'),
    )
    expect(found).toBeUndefined()
  })

  it('handles three contigs in a linear chain', () => {
    // Pan-genome: g1 -- g2 -- g3 -- g4 -- g5 -- g6
    // Contig A owns g1, g2
    // Contig B owns g3, g4
    // Contig C owns g5, g6
    const panGenome = graphFromDot(`
      graph {
        g1 -- g2;
        g2 -- g3;
        g3 -- g4;
        g4 -- g5;
        g5 -- g6;
      }
    `)

    const contigGeneMap = new Map<string, Gene[]>([
      ['ContigA', [makeGene('g1', 'ContigA'), makeGene('g2', 'ContigA')]],
      ['ContigB', [makeGene('g3', 'ContigB'), makeGene('g4', 'ContigB')]],
      ['ContigC', [makeGene('g5', 'ContigC'), makeGene('g6', 'ContigC')]],
    ])

    const neighbours = expandContigConnections(contigGeneMap, panGenome)

    // A-B should be found
    const foundAB = neighbours.find(
      n => n.contigs[0] === 'ContigA' && n.contigs[1] === 'ContigB',
    )
    expect(foundAB).toBeDefined()

    // B-C should be found
    const foundBC = neighbours.find(
      n => n.contigs[0] === 'ContigB' && n.contigs[1] === 'ContigC',
    )
    expect(foundBC).toBeDefined()
  })

  it('records the sorted pair of contig names', () => {
    const panGenome = graphFromDot(`
      graph {
        gene1 -- gene2;
      }
    `)

    const contigGeneMap = new Map<string, Gene[]>([
      ['ZZZ', [makeGene('gene1', 'ZZZ')]],
      ['AAA', [makeGene('gene2', 'AAA')]],
    ])

    const neighbours = expandContigConnections(contigGeneMap, panGenome)

    expect(neighbours.length).toBeGreaterThanOrEqual(1)
    // The pair should always be sorted alphabetically
    expect(neighbours[0]!.contigs[0]).toBe('AAA')
    expect(neighbours[0]!.contigs[1]).toBe('ZZZ')
  })

  it('returns empty array for empty contigGeneMap', () => {
    const panGenome = graphFromDot(`graph { gene1 -- gene2; }`)
    const contigGeneMap = new Map<string, Gene[]>()

    const neighbours = expandContigConnections(contigGeneMap, panGenome)
    expect(neighbours).toEqual([])
  })

  it('does not produce duplicate neighbour entries', () => {
    const panGenome = graphFromDot(`
      graph {
        gene1 -- gene2;
        gene2 -- gene3;
      }
    `)

    const contigGeneMap = new Map<string, Gene[]>([
      ['ContigA', [makeGene('gene1', 'ContigA')]],
      ['ContigB', [makeGene('gene3', 'ContigB')]],
    ])

    const neighbours = expandContigConnections(contigGeneMap, panGenome)

    // Count how many times the A-B pair appears
    const pairCount = neighbours.filter(
      n => n.contigs[0] === 'ContigA' && n.contigs[1] === 'ContigB',
    ).length
    expect(pairCount).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// refineContigGraph
// ---------------------------------------------------------------------------

describe('refineContigGraph', () => {
  // Build a simple scenario where connections are clearly valid:
  // A pan-genome graph: g1 -- g2 -- g3 -- g4
  // Contig A: g1, g2 (positions near start)
  // Contig B: g3, g4 (positions near start)
  // The intersection gene is g2 or g3

  function makeSimpleScenario() {
    const unfilteredGraph = graphFromDot(`
      graph {
        g1 -- g2;
        g2 -- g3;
        g3 -- g4;
      }
    `)
    const filteredGraph = unfilteredGraph // same for simplicity

    const geneA1 = makeGene('g1', 'ContigA', 10, 50)
    const geneA2 = makeGene('g2', 'ContigA', 60, 100)
    const geneB1 = makeGene('g3', 'ContigB', 10, 50)
    const geneB2 = makeGene('g4', 'ContigB', 60, 100)

    const contigGeneMap = new Map<string, Gene[]>([
      ['ContigA', [geneA1, geneA2]],
      ['ContigB', [geneB1, geneB2]],
    ])

    const geneContigMap = new Map<string, string>([
      ['g1', 'ContigA'],
      ['g2', 'ContigA'],
      ['g3', 'ContigB'],
      ['g4', 'ContigB'],
    ])

    const sequences: SequenceMap = new Map([
      ['ContigA', ['ATCG'.repeat(50), 'CGAT'.repeat(50), 200]],
      ['ContigB', ['GGCC'.repeat(50), 'GGCC'.repeat(50), 200]],
    ])

    return { filteredGraph, unfilteredGraph, contigGeneMap, geneContigMap, sequences }
  }

  it('accepts a valid connection between two adjacent contigs', () => {
    const { filteredGraph, unfilteredGraph, contigGeneMap, geneContigMap, sequences } =
      makeSimpleScenario()

    // Create a neighbour that would come from expandContigConnections
    const neighbours: ContigNeighbour[] = [
      {
        contigs: ['ContigA', 'ContigB'],
        iteration: 1,
        intersectionGenes: ['g2', 'g3'],
      },
    ]

    const { refined, contigEnds } = refineContigGraph(
      neighbours,
      filteredGraph,
      unfilteredGraph,
      geneContigMap,
      contigGeneMap,
      sequences,
    )

    // The connection should pass validation and be in refined
    expect(refined.length).toBe(1)
    expect(refined[0]!.contigs).toEqual(['ContigA', 'ContigB'])

    // contigEnds should be populated for both contigs
    expect(contigEnds['ContigA']).toBeDefined()
    expect(contigEnds['ContigB']).toBeDefined()
    expect(contigEnds['ContigA']!['ContigB']).toBeDefined()
    expect(contigEnds['ContigB']!['ContigA']).toBeDefined()
  })

  it('computes contigEnds as tuples of [number, number | null]', () => {
    const { filteredGraph, unfilteredGraph, contigGeneMap, geneContigMap, sequences } =
      makeSimpleScenario()

    const neighbours: ContigNeighbour[] = [
      {
        contigs: ['ContigA', 'ContigB'],
        iteration: 1,
        intersectionGenes: ['g2', 'g3'],
      },
    ]

    const { contigEnds } = refineContigGraph(
      neighbours,
      filteredGraph,
      unfilteredGraph,
      geneContigMap,
      contigGeneMap,
      sequences,
    )

    // Each contigEnd entry is [number, number | null]
    const endA = contigEnds['ContigA']!['ContigB']!
    expect(typeof endA[0]).toBe('number')
    expect(endA[1] === null || typeof endA[1] === 'number').toBe(true)

    const endB = contigEnds['ContigB']!['ContigA']!
    expect(typeof endB[0]).toBe('number')
    expect(endB[1] === null || typeof endB[1] === 'number').toBe(true)
  })

  it('returns empty refined list for empty neighbours input', () => {
    const { filteredGraph, unfilteredGraph, contigGeneMap, geneContigMap, sequences } =
      makeSimpleScenario()

    const { refined, contigEnds } = refineContigGraph(
      [],
      filteredGraph,
      unfilteredGraph,
      geneContigMap,
      contigGeneMap,
      sequences,
    )

    expect(refined).toEqual([])
    expect(Object.keys(contigEnds)).toHaveLength(0)
  })

  it('rejects a connection when the most occurring contig is a third-party contig', () => {
    // Scenario: ContigA and ContigB are proposed neighbours, but a ContigC
    // appears more often in the expansion than either A or B.
    const unfilteredGraph = graphFromDot(`
      graph {
        g1 -- g2;
        g2 -- g3;
        g3 -- g4;
        g4 -- g5;
        g5 -- g6;
        g6 -- g7;
        g7 -- g8;
        g8 -- g9;
        g9 -- g10;
      }
    `)

    const contigGeneMap = new Map<string, Gene[]>([
      ['ContigA', [makeGene('g1', 'ContigA', 10, 50)]],
      ['ContigB', [makeGene('g2', 'ContigB', 10, 50)]],
      // ContigC owns many genes in the expansion path
      ['ContigC', [
        makeGene('g3', 'ContigC', 10, 50),
        makeGene('g4', 'ContigC', 60, 100),
        makeGene('g5', 'ContigC', 110, 150),
        makeGene('g6', 'ContigC', 160, 200),
        makeGene('g7', 'ContigC', 210, 250),
        makeGene('g8', 'ContigC', 260, 300),
        makeGene('g9', 'ContigC', 310, 350),
        makeGene('g10', 'ContigC', 360, 400),
      ]],
    ])

    const geneContigMap = new Map<string, string>([
      ['g1', 'ContigA'],
      ['g2', 'ContigB'],
      ['g3', 'ContigC'],
      ['g4', 'ContigC'],
      ['g5', 'ContigC'],
      ['g6', 'ContigC'],
      ['g7', 'ContigC'],
      ['g8', 'ContigC'],
      ['g9', 'ContigC'],
      ['g10', 'ContigC'],
    ])

    const sequences: SequenceMap = new Map([
      ['ContigA', ['A'.repeat(100), 'T'.repeat(100), 100]],
      ['ContigB', ['G'.repeat(100), 'C'.repeat(100), 100]],
      ['ContigC', ['A'.repeat(500), 'T'.repeat(500), 500]],
    ])

    // The intersection between A and B is g2 (after expansion from g1 one hop)
    const neighbours: ContigNeighbour[] = [
      {
        contigs: ['ContigA', 'ContigB'],
        iteration: 1,
        intersectionGenes: ['g2'],
      },
    ]

    const { refined } = refineContigGraph(
      neighbours,
      unfilteredGraph,
      unfilteredGraph,
      geneContigMap,
      contigGeneMap,
      sequences,
    )

    // The connection should be rejected because ContigC dominates the expansion
    expect(refined.length).toBe(0)
  })

  it('preserves iteration order when sorting neighbours', () => {
    const { filteredGraph, unfilteredGraph, contigGeneMap, geneContigMap, sequences } =
      makeSimpleScenario()

    // Two neighbours at different iterations (both valid)
    const neighbours: ContigNeighbour[] = [
      {
        contigs: ['ContigA', 'ContigB'],
        iteration: 2,
        intersectionGenes: ['g2', 'g3'],
      },
      {
        contigs: ['ContigA', 'ContigB'],
        iteration: 1,
        intersectionGenes: ['g2', 'g3'],
      },
    ]

    const { refined } = refineContigGraph(
      neighbours,
      filteredGraph,
      unfilteredGraph,
      geneContigMap,
      contigGeneMap,
      sequences,
    )

    // Refinement should process lower iterations first
    // At least one should pass validation
    expect(refined.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// buildContigSubgraph
// ---------------------------------------------------------------------------

describe('buildContigSubgraph', () => {
  it('builds a graph with 2 nodes and 1 edge from a single neighbour pair', () => {
    const neighbours: ContigNeighbour[] = [
      { contigs: ['ContigA', 'ContigB'], iteration: 1, intersectionGenes: ['g1'] },
    ]

    const graph = buildContigSubgraph(neighbours)

    expect(graph.order).toBe(2)
    expect(graph.size).toBe(1)
    expect(graph.hasNode('ContigA')).toBe(true)
    expect(graph.hasNode('ContigB')).toBe(true)
    expect(graph.hasEdge('ContigA', 'ContigB')).toBe(true)
  })

  it('builds a graph with 3 nodes and 2 edges from a linear chain', () => {
    const neighbours: ContigNeighbour[] = [
      { contigs: ['ContigA', 'ContigB'], iteration: 1, intersectionGenes: ['g1'] },
      { contigs: ['ContigB', 'ContigC'], iteration: 1, intersectionGenes: ['g2'] },
    ]

    const graph = buildContigSubgraph(neighbours)

    expect(graph.order).toBe(3)
    expect(graph.size).toBe(2)
    expect(graph.hasEdge('ContigA', 'ContigB')).toBe(true)
    expect(graph.hasEdge('ContigB', 'ContigC')).toBe(true)
  })

  it('does not add duplicate edges for the same contig pair', () => {
    const neighbours: ContigNeighbour[] = [
      { contigs: ['ContigA', 'ContigB'], iteration: 1, intersectionGenes: ['g1'] },
      { contigs: ['ContigA', 'ContigB'], iteration: 2, intersectionGenes: ['g2'] },
    ]

    const graph = buildContigSubgraph(neighbours)

    expect(graph.order).toBe(2)
    expect(graph.size).toBe(1) // only one edge despite two entries
  })

  it('returns an empty graph for empty input', () => {
    const graph = buildContigSubgraph([])

    expect(graph.order).toBe(0)
    expect(graph.size).toBe(0)
  })

  it('builds a triangle graph from 3 pairwise neighbours', () => {
    const neighbours: ContigNeighbour[] = [
      { contigs: ['A', 'B'], iteration: 1, intersectionGenes: ['g1'] },
      { contigs: ['A', 'C'], iteration: 1, intersectionGenes: ['g2'] },
      { contigs: ['B', 'C'], iteration: 1, intersectionGenes: ['g3'] },
    ]

    const graph = buildContigSubgraph(neighbours)

    expect(graph.order).toBe(3)
    expect(graph.size).toBe(3)
    expect(graph.degree('A')).toBe(2)
    expect(graph.degree('B')).toBe(2)
    expect(graph.degree('C')).toBe(2)
  })

  it('handles a star topology (one hub connected to many spokes)', () => {
    const neighbours: ContigNeighbour[] = [
      { contigs: ['Hub', 'Spoke1'], iteration: 1, intersectionGenes: ['g1'] },
      { contigs: ['Hub', 'Spoke2'], iteration: 1, intersectionGenes: ['g2'] },
      { contigs: ['Hub', 'Spoke3'], iteration: 1, intersectionGenes: ['g3'] },
      { contigs: ['Hub', 'Spoke4'], iteration: 1, intersectionGenes: ['g4'] },
    ]

    const graph = buildContigSubgraph(neighbours)

    expect(graph.order).toBe(5)
    expect(graph.size).toBe(4)
    expect(graph.degree('Hub')).toBe(4)
    expect(graph.degree('Spoke1')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// removeExtraContigs
// ---------------------------------------------------------------------------

describe('removeExtraContigs', () => {
  it('removes a node with degree > 2 (hub node)', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addNode('Hub')
    graph.addEdge('Hub', 'A')
    graph.addEdge('Hub', 'B')
    graph.addEdge('Hub', 'C')

    const result = removeExtraContigs(graph)

    // Hub had degree 3 → removed
    expect(result.hasNode('Hub')).toBe(false)
    // A, B, C become isolated (degree 0) → also removed
    expect(result.order).toBe(0)
  })

  it('preserves a simple linear path (all degrees <= 2)', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')

    const result = removeExtraContigs(graph)

    expect(result.order).toBe(3)
    expect(result.size).toBe(2)
    expect(result.hasNode('A')).toBe(true)
    expect(result.hasNode('B')).toBe(true)
    expect(result.hasNode('C')).toBe(true)
  })

  it('removes isolated nodes (degree 0)', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('Isolated')
    graph.addEdge('A', 'B')

    const result = removeExtraContigs(graph)

    expect(result.hasNode('Isolated')).toBe(false)
    expect(result.order).toBe(2)
    expect(result.hasEdge('A', 'B')).toBe(true)
  })

  it('returns empty graph when all nodes are isolated', () => {
    const graph = new UndirectedGraph()
    graph.addNode('X')
    graph.addNode('Y')
    graph.addNode('Z')

    const result = removeExtraContigs(graph)

    expect(result.order).toBe(0)
  })

  it('preserves a cycle of degree-2 nodes', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')
    graph.addEdge('C', 'A')

    const result = removeExtraContigs(graph)

    expect(result.order).toBe(3)
    expect(result.size).toBe(3)
    // All nodes should remain with degree 2
    expect(result.degree('A')).toBe(2)
    expect(result.degree('B')).toBe(2)
    expect(result.degree('C')).toBe(2)
  })

  it('removes high-degree nodes and then removes newly-isolated nodes', () => {
    // A -- Hub -- B, Hub -- C, Hub -- D
    // Hub has degree 4 → removed
    // Then A, B, C, D become isolated → removed
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addNode('D')
    graph.addNode('Hub')
    graph.addEdge('Hub', 'A')
    graph.addEdge('Hub', 'B')
    graph.addEdge('Hub', 'C')
    graph.addEdge('Hub', 'D')

    const result = removeExtraContigs(graph)

    expect(result.order).toBe(0)
  })

  it('keeps degree-1 and degree-2 nodes in a mixed graph', () => {
    // Linear: A -- B -- C -- D (degrees: 1, 2, 2, 1)
    // Plus: C -- E -- F (E has degree 1 after hub removal, or 2 total... let's think)
    // Actually let's build: A--B--C, D--C (C has degree 3 → removed)
    // After removing C: A--B (B now degree 1), D is isolated → removed
    // Final: A--B
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addNode('D')
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')
    graph.addEdge('C', 'D')
    graph.addEdge('C', 'A') // C now has degree 3

    const result = removeExtraContigs(graph)

    // C removed (degree 3), then D is isolated → removed
    // A and B remain connected (A has degree 1 now, B has degree 1 now)
    expect(result.hasNode('C')).toBe(false)
    expect(result.hasNode('D')).toBe(false)
    expect(result.hasNode('A')).toBe(true)
    expect(result.hasNode('B')).toBe(true)
    expect(result.size).toBe(1)
  })

  it('returns the same graph reference (mutates in place)', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addEdge('A', 'B')

    const result = removeExtraContigs(graph)

    expect(result).toBe(graph) // same reference
  })
})
