import type { PanGenomeGraph } from './types'

/**
 * Parse a subset of Graphviz DOT format (undirected graphs from Roary output).
 *
 * Handles:
 *   - Node declarations:  geneName;
 *   - Edge declarations:  nodeA -- nodeB [weight=5.0];
 *   - Quoted identifiers: "gene name" -- "other gene";
 *   - Default weight = 1.0 when not specified
 *
 * Returns:
 *   nodes:   unique node names
 *   edges:   [source, target] pairs (in declaration order)
 *   weights: Map<"nodeA--nodeB", weight> (key uses sorted names joined by --)
 */
export function parseDot(text: string): PanGenomeGraph {
  const nodeSet = new Set<string>()
  const edges: [string, string][] = []
  const weights: Map<string, number> = new Map()

  // Strip C-style comments and split into statements by semicolons / braces
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')

  // Tokenise: split on ';' keeping content, also strip braces
  const statements = stripped
    .split(/[;{}]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const stmt of statements) {
    // Skip graph header lines like: strict graph "" {
    if (/^\s*(strict\s+)?(graph|digraph|subgraph)\b/i.test(stmt)) continue

    // Edge declaration: nodeA -- nodeB [attr=val, ...]
    const edgeMatch = stmt.match(
      /^("(?:[^"\\]|\\.)*"|[^\s\-[\]]+)\s*--\s*("(?:[^"\\]|\\.)*"|[^\s\-[\]]+)(?:\s*\[([^\]]*)\])?/
    )
    if (edgeMatch) {
      const src = unquote(edgeMatch[1]!)
      const tgt = unquote(edgeMatch[2]!)
      const attrStr = edgeMatch[3] ?? ''

      let weight = 1.0
      const wMatch = attrStr.match(/weight\s*=\s*([\d.eE+-]+)/)
      if (wMatch) {
        weight = parseFloat(wMatch[1]!)
      }

      nodeSet.add(src)
      nodeSet.add(tgt)
      edges.push([src, tgt])

      const key = edgeKey(src, tgt)
      // If the same edge appears multiple times, keep the last weight
      weights.set(key, weight)
      continue
    }

    // Node declaration: nodeName  (with optional attributes)
    // Ensure it's not a keyword line
    const nodeMatch = stmt.match(/^("(?:[^"\\]|\\.)*"|[^\s[\]]+)(?:\s*\[[^\]]*\])?$/)
    if (nodeMatch) {
      const name = unquote(nodeMatch[1]!)
      // Exclude DOT keywords
      if (!isDotKeyword(name)) {
        nodeSet.add(name)
      }
    }
  }

  return {
    nodes: Array.from(nodeSet),
    edges,
    weights,
  }
}

/** Canonical edge key: sorted alphabetically, joined with '--' */
function edgeKey(a: string, b: string): string {
  return [a, b].sort().join('--')
}

/** Strip surrounding double-quotes and unescape internal escapes */
function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\(.)/g, '$1')
  }
  return s
}

const DOT_KEYWORDS = new Set(['graph', 'digraph', 'subgraph', 'strict', 'node', 'edge'])
function isDotKeyword(s: string): boolean {
  return DOT_KEYWORDS.has(s.toLowerCase())
}

/**
 * Filter the pan-genome graph: for each node with degree >= 4,
 * remove the highest-weight edges when max weight != min weight.
 *
 * Port of GraphParser.filter_graph() from madansi.
 */
export function filterPanGenomeGraph(graph: PanGenomeGraph): PanGenomeGraph {
  // Build adjacency: node -> list of neighbour names
  const adjacency = new Map<string, string[]>()

  for (const node of graph.nodes) {
    adjacency.set(node, [])
  }

  for (const [src, tgt] of graph.edges) {
    if (!adjacency.has(src)) adjacency.set(src, [])
    if (!adjacency.has(tgt)) adjacency.set(tgt, [])
    adjacency.get(src)!.push(tgt)
    adjacency.get(tgt)!.push(src)
  }

  // Collect edges to remove
  const edgesToRemove = new Set<string>()

  for (const node of graph.nodes) {
    const neighbours = adjacency.get(node) ?? []
    if (neighbours.length < 4) continue

    // Gather weights for all edges from this node
    const edgeWeights: Array<{ key: string; weight: number }> = []
    for (const neighbour of neighbours) {
      const key = edgeKey(node, neighbour)
      const weight = graph.weights.get(key) ?? 1.0
      edgeWeights.push({ key, weight })
    }

    const minWeight = Math.min(...edgeWeights.map(e => e.weight))
    const maxWeight = Math.max(...edgeWeights.map(e => e.weight))

    if (maxWeight === minWeight) continue

    for (const { key, weight } of edgeWeights) {
      if (weight === maxWeight) {
        edgesToRemove.add(key)
      }
    }
  }

  // Rebuild graph without removed edges
  const filteredEdges = graph.edges.filter(
    ([src, tgt]) => !edgesToRemove.has(edgeKey(src, tgt))
  )

  const filteredWeights = new Map<string, number>()
  for (const [src, tgt] of filteredEdges) {
    const key = edgeKey(src, tgt)
    const w = graph.weights.get(key)
    if (w !== undefined) filteredWeights.set(key, w)
  }

  // Nodes stay the same (filter only removes edges, not nodes)
  return {
    nodes: graph.nodes,
    edges: filteredEdges,
    weights: filteredWeights,
  }
}
