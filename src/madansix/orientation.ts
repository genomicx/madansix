import type UndirectedGraph from 'graphology'
import type { ContigEnds, SequenceMap } from './types'

// ---------------------------------------------------------------------------
// Orientation helpers — port of DetermineOrientation.py
// ---------------------------------------------------------------------------

function determineOrientationDegree2(
  contig: string,
  contigEnds: ContigEnds,
  visited: string[],
  graph: UndirectedGraph,
  sequences: SequenceMap,
): 1 | -1 {
  const seqLen = sequences.get(contig)?.[2] ?? 0
  const previousContig = visited[visited.length - 1]!

  // Find the "next" neighbour (the one that is not the previous contig)
  let nextContig: string | null = null
  for (const neighbour of graph.neighbors(contig)) {
    if (neighbour !== previousContig) {
      nextContig = neighbour
      break
    }
  }

  if (!nextContig) {
    // Fallback: only one neighbour
    const ends = contigEnds[contig]?.[previousContig]
    if (!ends) return 1
    return ends[0] < seqLen / 2 ? -1 : 1
  }

  const endsPrev = contigEnds[contig]?.[previousContig]
  const endsNext = contigEnds[contig]?.[nextContig]

  if (!endsPrev || !endsNext) {
    return 1
  }

  const pos0 = endsPrev[0]
  const pos1 = endsNext[0]

  if (pos0 <= seqLen / 2 && pos1 > seqLen / 2) return 1
  if (pos0 > seqLen / 2 && pos1 <= seqLen / 2) return -1

  // Fall back to second position hints
  if (endsPrev[1] !== null) {
    return endsPrev[1] > endsPrev[0] ? 1 : -1
  }
  if (endsNext[1] !== null) {
    return endsNext[1] > endsNext[0] ? -1 : 1
  }

  return pos0 < pos1 ? 1 : -1
}

function determineOrientationStartContig(
  contig: string,
  contigEnds: ContigEnds,
  graph: UndirectedGraph,
  sequences: SequenceMap,
): 1 | -1 {
  const seqLen = sequences.get(contig)?.[2] ?? 0
  const neighbours = graph.neighbors(contig)
  if (neighbours.length === 0) return 1
  const neighbour = neighbours[0]!
  const ends = contigEnds[contig]?.[neighbour]
  if (!ends) return 1
  return ends[0] < seqLen / 2 ? -1 : 1
}

function determineOrientationEndContig(
  contig: string,
  contigEnds: ContigEnds,
  graph: UndirectedGraph,
  sequences: SequenceMap,
): 1 | -1 {
  const seqLen = sequences.get(contig)?.[2] ?? 0
  const neighbours = graph.neighbors(contig)
  if (neighbours.length === 0) return 1
  const neighbour = neighbours[0]!
  const ends = contigEnds[contig]?.[neighbour]
  if (!ends) return 1
  return ends[0] < seqLen / 2 ? 1 : -1
}

function determineInitialDirectionCycle(
  contig: string,
  contigEnds: ContigEnds,
  graph: UndirectedGraph,
): string {
  const neighbours = graph.neighbors(contig)
  if (neighbours.length < 2) return neighbours[0] ?? contig
  const n0 = neighbours[0]!
  const n1 = neighbours[1]!
  const pos0 = contigEnds[contig]?.[n0]?.[0] ?? 0
  const pos1 = contigEnds[contig]?.[n1]?.[0] ?? 0
  return pos0 > pos1 ? n0 : n1
}

// ---------------------------------------------------------------------------
// determineOrientations — main export
// ---------------------------------------------------------------------------

/**
 * Determine orientation for each contig in a connected component.
 * Port of GraphToFasta.walk_contig_graph() + DetermineOrientation.
 *
 * Returns Map<contigName, 1 | -1>.
 */
export function determineOrientations(
  component: string[],
  graph: UndirectedGraph,
  contigEnds: ContigEnds,
  sequences: SequenceMap,
): Map<string, 1 | -1> {
  const orientations = new Map<string, 1 | -1>()

  const isCycle = !component.some(c => graph.degree(c) === 1)

  // Find start contig
  let startContig: string
  if (!isCycle) {
    // degree-1 contigs sorted alphabetically; first one is the start
    const degreeOneContigs = component
      .filter(c => graph.degree(c) === 1)
      .sort()
    startContig = degreeOneContigs[0]!
    orientations.set(
      startContig,
      determineOrientationStartContig(startContig, contigEnds, graph, sequences),
    )
  } else {
    startContig = [...component].sort()[0]!
    orientations.set(startContig, 1)
  }

  const visited: string[] = [startContig]
  const visitedSet = new Set<string>([startContig])
  const orientationAssigned: string[] = [startContig]

  while (orientationAssigned.length < component.length) {
    const currentContig = visited[visited.length - 1]!

    if (visited.length === 1 && isCycle) {
      const nextNeighbour = determineInitialDirectionCycle(
        currentContig,
        contigEnds,
        graph,
      )
      const neighbours = graph.neighbors(currentContig)
      if (neighbours.length >= 2) {
        const degree = graph.degree(nextNeighbour)
        if (degree === 2) {
          orientations.set(
            nextNeighbour,
            determineOrientationDegree2(nextNeighbour, contigEnds, visited, graph, sequences),
          )
        } else {
          orientations.set(nextNeighbour, 1)
        }
      } else {
        orientations.set(nextNeighbour, 1)
      }
      orientationAssigned.push(nextNeighbour)
      visited.push(nextNeighbour)
      visitedSet.add(nextNeighbour)
    } else {
      let neighbour: string | null = null
      for (const n of graph.neighbors(currentContig)) {
        if (!visitedSet.has(n)) {
          neighbour = n
          break
        }
      }
      if (neighbour === null) break

      const degree = graph.degree(neighbour)
      if (degree === 2) {
        orientations.set(
          neighbour,
          determineOrientationDegree2(neighbour, contigEnds, visited, graph, sequences),
        )
      } else if (degree === 1) {
        orientations.set(
          neighbour,
          determineOrientationEndContig(neighbour, contigEnds, graph, sequences),
        )
      } else {
        orientations.set(neighbour, 1)
      }

      orientationAssigned.push(neighbour)
      visited.push(neighbour)
      visitedSet.add(neighbour)
    }
  }

  return orientations
}
