import type UndirectedGraph from 'graphology'
import { connectedComponents } from 'graphology-components'
import type { FastaRecord, ContigEdge, ContigEnds, SequenceMap } from './types'
// FastaRecord used by assembleOrderedFasta return type and allContigs param
import { determineOrientations } from './orientation'

const GAP = 'N'.repeat(200)

// ---------------------------------------------------------------------------
// computeN50
// ---------------------------------------------------------------------------

/**
 * Compute N50 from an array of sequence lengths (in bp).
 * N50 = the length of the shortest sequence such that 50% of the total
 * assembly length is covered by sequences of that length or longer.
 */
export function computeN50(lengths: number[]): number {
  if (lengths.length === 0) return 0

  const sorted = [...lengths].sort((a, b) => b - a)
  const total = sorted.reduce((sum, l) => sum + l, 0)
  const half = total / 2

  let cumulative = 0
  for (const len of sorted) {
    cumulative += len
    if (cumulative >= half) return len
  }

  return sorted[sorted.length - 1] ?? 0
}

// ---------------------------------------------------------------------------
// assembleOrderedFasta
// ---------------------------------------------------------------------------

/**
 * Traverse connected components of the contig graph, determine orientations,
 * join contigs with 200-N gaps, and append any unused contigs at the end.
 *
 * Port of GraphToFasta.create_fasta_file_combined_contigs() + UnusedContigs.
 */
export function assembleOrderedFasta(
  graph: UndirectedGraph,
  sequences: SequenceMap,
  contigEnds: ContigEnds,
  allContigs: FastaRecord[],
): FastaRecord[] {
  const result: FastaRecord[] = []
  const usedContigs = new Set<string>()

  // Get connected components sorted by size descending (largest first)
  const components = connectedComponents(graph).sort(
    (a, b) => b.length - a.length,
  )

  let contigCount = 1

  for (const component of components) {
    const orientations = determineOrientations(
      component,
      graph,
      contigEnds,
      sequences,
    )

    // Walk the component in visit order
    const visited = walkComponent(component, graph, contigEnds)

    const parts: string[] = []
    for (const contig of visited) {
      const orientation = orientations.get(contig) ?? 1
      const seqEntry = sequences.get(contig)
      if (!seqEntry) continue

      parts.push(orientation === 1 ? seqEntry[0] : seqEntry[1])
      usedContigs.add(contig)
    }
    const combined = parts.join(GAP)

    if (combined.length > 0) {
      result.push({ name: `Contig${contigCount}`, sequence: combined })
      contigCount++
    }
  }

  // Append unused contigs (UnusedContigs equivalent)
  for (const record of allContigs) {
    if (!usedContigs.has(record.name)) {
      result.push({ name: record.name, sequence: record.sequence })
    }
  }

  return result
}

/**
 * Walk a component in the same order as GraphToFasta.walk_contig_graph().
 * Returns ordered list of contig names.
 */
function walkComponent(
  component: string[],
  graph: UndirectedGraph,
  contigEnds: ContigEnds,
): string[] {
  const isCycle = !component.some(c => graph.degree(c) === 1)

  // Find start contig
  let startContig: string
  if (!isCycle) {
    const degreeOneContigs = component
      .filter(c => graph.degree(c) === 1)
      .sort()
    startContig = degreeOneContigs[0]!
  } else {
    startContig = [...component].sort()[0]!
  }

  const visited: string[] = [startContig]

  if (component.length === 1) return visited

  while (visited.length < component.length) {
    const current = visited[visited.length - 1]!

    if (visited.length === 1 && isCycle) {
      // Choose initial direction for cycle
      const neighbours = graph.neighbors(current)
      if (neighbours.length < 2) {
        const n = neighbours[0]
        if (n && !visited.includes(n)) visited.push(n)
        break
      }
      const n0 = neighbours[0]!
      const n1 = neighbours[1]!
      const pos0 = contigEnds[current]?.[n0]?.[0] ?? 0
      const pos1 = contigEnds[current]?.[n1]?.[0] ?? 0
      const next = pos0 > pos1 ? n0 : n1
      visited.push(next)
    } else {
      let found = false
      for (const n of graph.neighbors(current)) {
        if (!visited.includes(n)) {
          visited.push(n)
          found = true
          break
        }
      }
      if (!found) break
    }
  }

  return visited
}

// ---------------------------------------------------------------------------
// graphToDot
// ---------------------------------------------------------------------------

/**
 * Generate a DOT format string for a list of contig edges.
 */
export function graphToDot(edges: ContigEdge[]): string {
  const lines: string[] = ['strict graph "" {']

  // Collect unique nodes
  const nodes = new Set<string>()
  for (const { source, target } of edges) {
    nodes.add(source)
    nodes.add(target)
  }

  for (const node of [...nodes].sort()) {
    lines.push(`  ${JSON.stringify(node)};`)
  }

  for (const { source, target } of edges) {
    lines.push(`  ${JSON.stringify(source)} -- ${JSON.stringify(target)};`)
  }

  lines.push('}')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// graphToEdges
// ---------------------------------------------------------------------------

/**
 * Convert graphology graph edges to ContigEdge[] for D3 visualisation.
 */
export function graphToEdges(graph: UndirectedGraph): ContigEdge[] {
  return graph.edges().map(e => ({
    source: graph.source(e),
    target: graph.target(e),
  }))
}
