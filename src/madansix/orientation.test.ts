import { describe, it, expect } from 'vitest'
import { determineOrientations } from './orientation'
import type { ContigEnds, SequenceMap } from './types'
import UndirectedGraph from 'graphology'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a SequenceMap with given contig names and lengths.
 * Forward/reverse sequences are dummy strings of the correct length.
 */
function makeSequences(entries: Array<[string, number]>): SequenceMap {
  const map: SequenceMap = new Map()
  for (const [name, len] of entries) {
    map.set(name, ['A'.repeat(len), 'T'.repeat(len), len])
  }
  return map
}

// ---------------------------------------------------------------------------
// determineOrientations
// ---------------------------------------------------------------------------

describe('determineOrientations', () => {
  it('assigns orientation 1 to a single isolated contig', () => {
    const graph = new UndirectedGraph()
    graph.addNode('ContigA')

    const contigEnds: ContigEnds = {}
    const sequences = makeSequences([['ContigA', 1000]])

    const orientations = determineOrientations(
      ['ContigA'],
      graph,
      contigEnds,
      sequences,
    )

    expect(orientations.size).toBe(1)
    expect(orientations.get('ContigA')).toBe(1)
  })

  it('assigns orientations to a 2-contig linear path', () => {
    // A -- B (both degree 1, so A is start, B is end)
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addEdge('A', 'B')

    // A's gene near start (position 100 on a 1000bp contig → < 500 → orientation -1 for start contig)
    // B's gene near end (position 800 on a 1000bp contig → >= 500 → orientation 1 for end contig)
    const contigEnds: ContigEnds = {
      A: { B: [100, 200] },
      B: { A: [800, 700] },
    }
    const sequences = makeSequences([['A', 1000], ['B', 1000]])

    const orientations = determineOrientations(
      ['A', 'B'],
      graph,
      contigEnds,
      sequences,
    )

    expect(orientations.size).toBe(2)
    // Start contig A: ends[0] = 100 < 500 (seqLen/2) → orientation = -1
    expect(orientations.get('A')).toBe(-1)
    // End contig B: ends[0] = 800 >= 500 → orientation = 1 (end contig: < half → 1, >= half → see code)
    // Actually for end contig: ends[0] < seqLen/2 → 1, else → (fallback to default 1)
    // B's ends[0] = 800 >= 500, so determineOrientationEndContig returns: ends[0] < seqLen/2 ? 1 : -1
    // 800 < 500 is false → returns -1
    expect(orientations.get('B')).toBe(-1)
  })

  it('assigns orientations to a 2-contig path with genes at opposite ends', () => {
    // A -- B (both degree 1)
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addEdge('A', 'B')

    // A's gene near end (position 800) → start contig with pos >= 500 → orientation = 1
    // B's gene near start (position 100) → end contig with pos < 500 → orientation = 1
    const contigEnds: ContigEnds = {
      A: { B: [800, 700] },
      B: { A: [100, 200] },
    }
    const sequences = makeSequences([['A', 1000], ['B', 1000]])

    const orientations = determineOrientations(
      ['A', 'B'],
      graph,
      contigEnds,
      sequences,
    )

    expect(orientations.size).toBe(2)
    // Start contig A: ends[0] = 800 >= 500 → orientation = 1
    expect(orientations.get('A')).toBe(1)
    // End contig B: ends[0] = 100 < 500 → orientation = 1
    expect(orientations.get('B')).toBe(1)
  })

  it('assigns orientations to a 3-contig linear path', () => {
    // A -- B -- C (A and C are degree 1, B is degree 2)
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')

    // A connects to B, B connects to A and C, C connects to B
    // For B (degree 2): previous=A, next=C
    // B's position toward A is at start (100), toward C is at end (900)
    // pos0(prev) = 100 <= 500, pos1(next) = 900 > 500 → orientation = 1
    const contigEnds: ContigEnds = {
      A: { B: [800, 700] },
      B: { A: [100, 200], C: [900, 800] },
      C: { B: [200, 300] },
    }
    const sequences = makeSequences([['A', 1000], ['B', 1000], ['C', 1000]])

    const orientations = determineOrientations(
      ['A', 'B', 'C'],
      graph,
      contigEnds,
      sequences,
    )

    expect(orientations.size).toBe(3)
    // All three contigs should get an orientation
    expect(orientations.has('A')).toBe(true)
    expect(orientations.has('B')).toBe(true)
    expect(orientations.has('C')).toBe(true)

    // Verify each orientation is either 1 or -1
    for (const [, orient] of orientations) {
      expect([1, -1]).toContain(orient)
    }

    // B degree-2: previous=A, next=C
    // endsPrev = contigEnds[B][A] = [100, 200], pos0 = 100
    // endsNext = contigEnds[B][C] = [900, 800], pos1 = 900
    // 100 <= 500 && 900 > 500 → return 1
    expect(orientations.get('B')).toBe(1)
  })

  it('handles a 3-contig linear path where middle contig is reversed', () => {
    // A -- B -- C
    // B's gene toward A is at end (900), toward C is at start (100)
    // pos0(prev) = 900 > 500, pos1(next) = 100 <= 500 → orientation = -1
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')

    const contigEnds: ContigEnds = {
      A: { B: [100, 200] },
      B: { A: [900, 800], C: [100, 200] },
      C: { B: [800, 700] },
    }
    const sequences = makeSequences([['A', 1000], ['B', 1000], ['C', 1000]])

    const orientations = determineOrientations(
      ['A', 'B', 'C'],
      graph,
      contigEnds,
      sequences,
    )

    // B: pos0=900 > 500, pos1=100 <= 500 → orientation = -1
    expect(orientations.get('B')).toBe(-1)
  })

  it('handles a cycle of 3 contigs', () => {
    // A -- B -- C -- A (all degree 2, no degree-1 node → cycle)
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')
    graph.addEdge('C', 'A')

    const contigEnds: ContigEnds = {
      A: { B: [800, 700], C: [200, 300] },
      B: { A: [100, 200], C: [900, 800] },
      C: { B: [100, 200], A: [900, 800] },
    }
    const sequences = makeSequences([['A', 1000], ['B', 1000], ['C', 1000]])

    const orientations = determineOrientations(
      ['A', 'B', 'C'],
      graph,
      contigEnds,
      sequences,
    )

    expect(orientations.size).toBe(3)
    // In a cycle, start contig is alphabetically first → A
    // A gets orientation 1 (hardcoded for cycle start)
    expect(orientations.get('A')).toBe(1)

    // All contigs should have orientations
    expect(orientations.has('B')).toBe(true)
    expect(orientations.has('C')).toBe(true)
  })

  it('picks the alphabetically-first degree-1 contig as start for a linear path', () => {
    // Z -- M -- A (degree-1 contigs are Z and A; alphabetically first is A)
    const graph = new UndirectedGraph()
    graph.addNode('Z')
    graph.addNode('M')
    graph.addNode('A')
    graph.addEdge('Z', 'M')
    graph.addEdge('M', 'A')

    const contigEnds: ContigEnds = {
      A: { M: [800, 700] },
      M: { A: [100, 200], Z: [900, 800] },
      Z: { M: [200, 300] },
    }
    const sequences = makeSequences([['A', 1000], ['M', 1000], ['Z', 1000]])

    const orientations = determineOrientations(
      ['Z', 'M', 'A'],
      graph,
      contigEnds,
      sequences,
    )

    // A is degree 1 and alphabetically first → start contig
    // A's ends toward M: [800, 700], pos=800 >= 500 → start orientation = 1
    expect(orientations.get('A')).toBe(1)
    expect(orientations.size).toBe(3)
  })

  it('returns orientation 1 when contigEnds data is missing', () => {
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addEdge('A', 'B')

    // Empty contigEnds means fallback to default
    const contigEnds: ContigEnds = {}
    const sequences = makeSequences([['A', 1000], ['B', 1000]])

    const orientations = determineOrientations(
      ['A', 'B'],
      graph,
      contigEnds,
      sequences,
    )

    // With no data, both should default to 1
    expect(orientations.get('A')).toBe(1)
    expect(orientations.get('B')).toBe(1)
  })

  it('uses second position hint when both positions are on the same side', () => {
    // A -- B -- C
    // B's positions toward both neighbours are on the same side (both < half)
    // Should fall back to second position hint
    const graph = new UndirectedGraph()
    graph.addNode('A')
    graph.addNode('B')
    graph.addNode('C')
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')

    // B: both pos0 values are < 500 (same side)
    // Fall back to endsPrev[1] hint: 300 > 100 → return 1
    const contigEnds: ContigEnds = {
      A: { B: [800, 700] },
      B: { A: [100, 300], C: [200, 50] },
      C: { B: [800, 700] },
    }
    const sequences = makeSequences([['A', 1000], ['B', 1000], ['C', 1000]])

    const orientations = determineOrientations(
      ['A', 'B', 'C'],
      graph,
      contigEnds,
      sequences,
    )

    // B degree 2: pos0=100, pos1=200 → both <= 500
    // Not matched by first two conditions
    // Fall back: endsPrev[1] = 300, endsPrev[0] = 100 → 300 > 100 → return 1
    expect(orientations.get('B')).toBe(1)
  })
})
