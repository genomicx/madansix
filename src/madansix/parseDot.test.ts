import { describe, it, expect } from 'vitest'
import { parseDot, filterPanGenomeGraph } from './parseDot'

const GRAPH_5_NODES_DOT = `strict graph "" {
gene1;
gene2;
geneA;
gene4;
gene5;
gene1 -- gene2;
gene2 -- geneA;
geneA -- gene4;
gene4 -- gene5;
}`

describe('parseDot', () => {
  it('parses 5 nodes from graph_5_nodes.dot', () => {
    const graph = parseDot(GRAPH_5_NODES_DOT)
    expect(graph.nodes).toHaveLength(5)
    expect(graph.nodes).toContain('gene1')
    expect(graph.nodes).toContain('gene2')
    expect(graph.nodes).toContain('geneA')
    expect(graph.nodes).toContain('gene4')
    expect(graph.nodes).toContain('gene5')
  })

  it('parses 4 edges from graph_5_nodes.dot', () => {
    const graph = parseDot(GRAPH_5_NODES_DOT)
    expect(graph.edges).toHaveLength(4)
  })

  it('parses edge connections correctly', () => {
    const graph = parseDot(GRAPH_5_NODES_DOT)
    const edgeStrings = graph.edges.map(([a, b]) => `${a}--${b}`)
    expect(edgeStrings).toContain('gene1--gene2')
    expect(edgeStrings).toContain('gene2--geneA')
    expect(edgeStrings).toContain('geneA--gene4')
    expect(edgeStrings).toContain('gene4--gene5')
  })

  it('assigns default weight of 1.0 to unweighted edges', () => {
    const graph = parseDot(GRAPH_5_NODES_DOT)
    for (const [a, b] of graph.edges) {
      const key = [a, b].sort().join('--')
      expect(graph.weights.get(key)).toBe(1.0)
    }
  })

  it('parses weighted edges correctly', () => {
    const weightedDot = `strict graph "" {
nodeA;
nodeB;
nodeC;
nodeA -- nodeB [weight=3.5];
nodeB -- nodeC [weight=2.0];
}`
    const graph = parseDot(weightedDot)

    expect(graph.edges).toHaveLength(2)

    const keyAB = ['nodeA', 'nodeB'].sort().join('--')
    const keyBC = ['nodeB', 'nodeC'].sort().join('--')

    expect(graph.weights.get(keyAB)).toBe(3.5)
    expect(graph.weights.get(keyBC)).toBe(2.0)
  })

  it('returns empty nodes and edges for empty graph', () => {
    const graph = parseDot('strict graph "" {}')
    expect(graph.nodes).toHaveLength(0)
    expect(graph.edges).toHaveLength(0)
  })

  it('handles quoted node identifiers', () => {
    const quotedDot = `graph "" {
"gene name A";
"gene name B";
"gene name A" -- "gene name B";
}`
    const graph = parseDot(quotedDot)
    expect(graph.nodes).toContain('gene name A')
    expect(graph.nodes).toContain('gene name B')
    expect(graph.edges).toHaveLength(1)
  })
})

describe('filterPanGenomeGraph', () => {
  it('leaves a 5-node/4-edge linear graph unchanged (no node has degree >= 4)', () => {
    const graph = parseDot(GRAPH_5_NODES_DOT)

    // Verify no node has degree >= 4 in this simple linear graph
    const degreeCounts: Record<string, number> = {}
    for (const node of graph.nodes) degreeCounts[node] = 0
    for (const [a, b] of graph.edges) {
      degreeCounts[a] = (degreeCounts[a] ?? 0) + 1
      degreeCounts[b] = (degreeCounts[b] ?? 0) + 1
    }
    const maxDegree = Math.max(...Object.values(degreeCounts))
    expect(maxDegree).toBeLessThan(4)

    const filtered = filterPanGenomeGraph(graph)
    expect(filtered.nodes).toHaveLength(graph.nodes.length)
    expect(filtered.edges).toHaveLength(graph.edges.length)
  })

  it('removes highest-weight edges from nodes with degree >= 4 when weights differ', () => {
    // Hub node 'center' connected to 5 others with varying weights
    const hubDot = `strict graph "" {
center;
a;
b;
c;
d;
e;
center -- a [weight=1.0];
center -- b [weight=1.0];
center -- c [weight=1.0];
center -- d [weight=5.0];
center -- e [weight=5.0];
}`
    const graph = parseDot(hubDot)
    const filtered = filterPanGenomeGraph(graph)

    // The two highest-weight edges (to d and e) should be removed
    const filteredEdgeStrings = filtered.edges.map(([a, b]) => `${[a, b].sort().join('--')}`)
    expect(filteredEdgeStrings).not.toContain('center--d')
    expect(filteredEdgeStrings).not.toContain('center--e')
    expect(filteredEdgeStrings).toContain('a--center')
    expect(filteredEdgeStrings).toContain('b--center')
    expect(filteredEdgeStrings).toContain('c--center')
  })

  it('leaves edges unchanged when all weights are equal for a high-degree node', () => {
    const equalWeightDot = `strict graph "" {
center;
a;
b;
c;
d;
center -- a [weight=2.0];
center -- b [weight=2.0];
center -- c [weight=2.0];
center -- d [weight=2.0];
}`
    const graph = parseDot(equalWeightDot)
    const filtered = filterPanGenomeGraph(graph)
    // All weights equal → no edges removed
    expect(filtered.edges).toHaveLength(graph.edges.length)
  })
})
