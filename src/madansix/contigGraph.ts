import UndirectedGraph from 'graphology'
import type { ContigNeighbour, ContigEnds, Gene, PanGenomeGraph, SequenceMap } from './types'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find all neighbours of a set of nodes in the pan-genome graph.
 * Port of NeighboursOfNodes.find_neighbours().
 */
function findNeighboursOfNodes(
  adj: Map<string, string[]>,
  graphNodeSet: Set<string>,
  nodeList: string[],
): string[] {
  const nodeSet = new Set(nodeList)
  const seen = new Set<string>()

  for (const node of nodeList) {
    if (!graphNodeSet.has(node)) continue
    for (const neighbour of (adj.get(node) ?? [])) {
      if (!nodeSet.has(neighbour) && !seen.has(neighbour)) {
        seen.add(neighbour)
      }
    }
  }

  return Array.from(seen)
}

/** Build an adjacency list from a PanGenomeGraph */
function buildAdjacency(graph: PanGenomeGraph): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const node of graph.nodes) {
    adj.set(node, [])
  }
  for (const [src, tgt] of graph.edges) {
    if (!adj.has(src)) adj.set(src, [])
    if (!adj.has(tgt)) adj.set(tgt, [])
    adj.get(src)!.push(tgt)
    adj.get(tgt)!.push(src)
  }
  return adj
}

/** Get degree of a node in a PanGenomeGraph */
function nodeDegree(adj: Map<string, string[]>, node: string): number {
  return (adj.get(node) ?? []).length
}

// ---------------------------------------------------------------------------
// expandContigConnections
// ---------------------------------------------------------------------------

/**
 * Port of ContigSearching.expand_all_contigs().
 *
 * For each contig, start with its gene set and iteratively expand into the
 * pan-genome graph neighbourhood.  When two contigs' expanded gene sets
 * overlap, they are recorded as neighbours.
 */
export function expandContigConnections(
  contigGeneMap: Map<string, Gene[]>,
  filteredGraph: PanGenomeGraph,
): ContigNeighbour[] {
  const adj = buildAdjacency(filteredGraph)
  const graphNodeSet = new Set(filteredGraph.nodes)

  const genesInContigRadius = new Map<string, string[]>()

  const finishedContigs = new Set<string>()
  const foundContigs = new Set<string>()
  const neighbouringContigs: ContigNeighbour[] = []
  const seenPairs = new Set<string>()

  function setExpansion(geneNames: string[], sequenceName: string): void {
    const neighbouring = findNeighboursOfNodes(adj, graphNodeSet, geneNames)
    genesInContigRadius.set(sequenceName, [...geneNames, ...neighbouring])
    if (neighbouring.length === 0) {
      finishedContigs.add(sequenceName)
      foundContigs.add(sequenceName)
    }
  }

  function checkIntersections(iterationCount: number): void {
    const entries = Array.from(genesInContigRadius.entries())
    for (let i = 0; i < entries.length; i++) {
      const [name1, genes1] = entries[i]!
      if (genes1.length === 0) continue
      const set1 = new Set(genes1)
      for (let j = i + 1; j < entries.length; j++) {
        const [name2, genes2] = entries[j]!
        if (genes2.length === 0) continue
        if (name1 === name2) continue

        const intersection = genes2.filter(g => set1.has(g))
        if (intersection.length === 0) continue

        const sortedPair = [name1, name2].sort() as [string, string]
        const pairKey = `${sortedPair[0]}\x00${sortedPair[1]}`
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey)
          neighbouringContigs.push({
            contigs: sortedPair,
            iteration: iterationCount,
            intersectionGenes: [...intersection].sort(),
          })
          foundContigs.add(name1)
          foundContigs.add(name2)
        }
      }
    }
  }

  for (const [seqName, genes] of contigGeneMap) {
    const geneNames = genes.map(g => g.name)
    setExpansion(geneNames, seqName)
  }

  const allContigs = new Set(contigGeneMap.keys())

  let iterationCount = 1
  checkIntersections(iterationCount)

  while (
    setDifference(allContigs, finishedContigs).size > 0 &&
    setDifference(allContigs, foundContigs).size > 0
  ) {
    iterationCount++
    for (const [seqName, genes] of genesInContigRadius) {
      setExpansion(genes, seqName)
    }
    checkIntersections(iterationCount)
  }

  return neighbouringContigs
}

function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>()
  for (const x of a) {
    if (!b.has(x)) result.add(x)
  }
  return result
}

// ---------------------------------------------------------------------------
// refineContigGraph
// ---------------------------------------------------------------------------

/**
 * Port of RefineContigNeighbours.refine_contig_neighbours() + ends_of_contigs().
 */
export function refineContigGraph(
  neighbours: ContigNeighbour[],
  _filteredGraph: PanGenomeGraph,
  unfilteredGraph: PanGenomeGraph,
  geneContigMap: Map<string, string>,
  contigGeneMap: Map<string, Gene[]>,
  sequences: SequenceMap,
): { refined: ContigNeighbour[]; contigEnds: ContigEnds } {
  const unfilteredAdj = buildAdjacency(unfilteredGraph)

  // Build gene_objects lookup: contig -> Map<geneName, Gene>
  const contigGeneObjects = new Map<string, Map<string, Gene>>()
  for (const [contig, genes] of contigGeneMap) {
    const geneMap = new Map<string, Gene>()
    for (const g of genes) {
      geneMap.set(g.name, g)
    }
    contigGeneObjects.set(contig, geneMap)
  }

  // -------------------------------------------------------------------------
  // find_contig_appearances for a single neighbour entry
  // -------------------------------------------------------------------------
  type ContigAppearance = {
    count: number
    byIteration: Map<number, string[]>
  }

  function findContigAppearances(
    nb: ContigNeighbour,
  ): Map<string, ContigAppearance> {
    const contigApps = new Map<string, ContigAppearance>()
    contigApps.set(nb.contigs[0], { count: 0, byIteration: new Map() })
    contigApps.set(nb.contigs[1], { count: 0, byIteration: new Map() })

    const seenNodes: string[] = [...nb.intersectionGenes]

    function addToAppearance(gene: string, iteration: number): void {
      const contig = geneContigMap.get(gene)
      if (contig === undefined) return
      if (!contigApps.has(contig)) {
        contigApps.set(contig, { count: 1, byIteration: new Map([[iteration, [gene]]]) })
        return
      }
      const app = contigApps.get(contig)!
      app.count += 1
      if (!app.byIteration.has(iteration)) {
        app.byIteration.set(iteration, [gene])
      } else {
        app.byIteration.get(iteration)!.push(gene)
        app.byIteration.get(iteration)!.sort()
      }
    }

    // Iteration 0: intersection genes
    for (const g of nb.intersectionGenes) {
      addToAppearance(g, 0)
    }

    // Expand nb.iteration + 3 more hops in the unfiltered graph
    for (let i = 0; i < nb.iteration + 3; i++) {
      const newNeighbours = findNeighboursOfNodesAdj(unfilteredAdj, seenNodes)
      for (const nn of newNeighbours) {
        seenNodes.push(nn)
        addToAppearance(nn, i + 1)
      }
    }

    return contigApps
  }

  function findNeighboursOfNodesAdj(
    adj: Map<string, string[]>,
    nodeList: string[],
  ): string[] {
    const nodeSet = new Set(nodeList)
    const seen = new Set<string>()
    for (const node of nodeList) {
      for (const nb of (adj.get(node) ?? [])) {
        if (!nodeSet.has(nb) && !seen.has(nb)) {
          seen.add(nb)
        }
      }
    }
    return Array.from(seen)
  }

  // -------------------------------------------------------------------------
  // Gene degree helper (unfiltered)
  // -------------------------------------------------------------------------
  function geneDegree(gene: string): number {
    return nodeDegree(unfilteredAdj, gene)
  }

  // -------------------------------------------------------------------------
  // remove_gene_degree_one
  // -------------------------------------------------------------------------
  function removeGeneDegreeOne(
    nb: ContigNeighbour,
    contigApps: Map<string, ContigAppearance>,
    contigIdx: 0 | 1,
    iteration: number,
  ): string[] {
    const contig = nb.contigs[contigIdx]
    const app = contigApps.get(contig)
    if (!app) return []
    const genes = app.byIteration.get(iteration) ?? []
    return genes.filter(g => geneDegree(g) !== 1)
  }

  // -------------------------------------------------------------------------
  // getting_query_start_tuples
  // -------------------------------------------------------------------------
  function getQueryStartTuples(
    nb: ContigNeighbour,
    contigApps: Map<string, ContigAppearance>,
    contigIdx: 0 | 1,
  ): [number, number | null] {
    const contig = nb.contigs[contigIdx]
    const app = contigApps.get(contig)
    if (!app) return [0, null]

    const geneObjs = contigGeneObjects.get(contig) ?? new Map<string, Gene>()
    const seqLen = sequences.get(contig)?.[2] ?? 0
    const iterations = [...app.byIteration.keys()].sort((a, b) => a - b)

    if (iterations.length === 0) return [0, null]

    const iter0 = iterations[0]!
    const genesAtIter0 = app.byIteration.get(iter0) ?? []

    if (iterations.length >= 2) {
      const iter1 = iterations[1]!
      const genesAtIter1 = app.byIteration.get(iter1) ?? []
      const degOneFiltered0 = removeGeneDegreeOne(nb, contigApps, contigIdx, iter0)

      if (degOneFiltered0.length === 1) {
        const degOneFiltered1 = removeGeneDegreeOne(nb, contigApps, contigIdx, iter1)
        if (degOneFiltered1.length === 1) {
          const qs0 = geneObjs.get(degOneFiltered0[0]!)?.queryStart ?? 0
          const qs1 = geneObjs.get(degOneFiltered1[0]!)?.queryStart ?? 0
          return [qs0, qs1]
        } else {
          // Check if all iter1 genes are on same side of iter0 gene
          const qs0 = geneObjs.get(genesAtIter0[0]!)?.queryStart ?? 0
          const iter1Starts = genesAtIter1.map(g => geneObjs.get(g)?.queryStart ?? 0)
          const allLess = iter1Starts.every(s => s < qs0)
          const allGte = iter1Starts.every(s => s >= qs0)
          if (allLess || allGte) {
            return [qs0, geneObjs.get(genesAtIter1[0]!)?.queryStart ?? 0]
          } else {
            if (qs0 < seqLen / 2) {
              return [qs0, seqLen]
            } else {
              return [qs0, 1]
            }
          }
        }
      } else {
        // Multiple genes at iteration 0
        const iter0Starts = genesAtIter0.map(g => geneObjs.get(g)?.queryStart ?? 0)
        if (iter0Starts.every(s => s < seqLen / 2)) {
          return [geneObjs.get(genesAtIter0[0]!)?.queryStart ?? 0, seqLen]
        } else if (iter0Starts.every(s => s >= seqLen / 2)) {
          return [geneObjs.get(genesAtIter0[0]!)?.queryStart ?? 0, 1]
        } else {
          const iter1Starts = genesAtIter1.map(g => geneObjs.get(g)?.queryStart ?? 0)
          if (iter1Starts.every(s => s < seqLen / 2)) {
            return [geneObjs.get(genesAtIter1[0]!)?.queryStart ?? 0, seqLen]
          } else if (iter1Starts.every(s => s >= seqLen / 2)) {
            return [geneObjs.get(genesAtIter1[0]!)?.queryStart ?? 0, 1]
          } else {
            return [0, null]
          }
        }
      }
    } else {
      // Only one iteration
      const qs0 = geneObjs.get(genesAtIter0[0]!)?.queryStart ?? 0
      if (qs0 < seqLen / 2) {
        return [qs0, seqLen]
      } else {
        return [qs0, 1]
      }
    }
  }

  // -------------------------------------------------------------------------
  // check_if_connection_is_valid
  // -------------------------------------------------------------------------
  function checkIfConnectionIsValid(nb: ContigNeighbour): boolean {
    const contigApps = findContigAppearances(nb)

    const app0 = contigApps.get(nb.contigs[0])!
    const app1 = contigApps.get(nb.contigs[1])!

    const genes0 = contigGeneMap.get(nb.contigs[0]) ?? []
    const genes1 = contigGeneMap.get(nb.contigs[1]) ?? []

    const minCount0 = Math.min(2, genes0.length)
    const minCount1 = Math.min(2, genes1.length)

    const maxCount = nb.iteration + 4  // range(n+3) exclusive → n+3 as max, but Python range is [min, max)

    if (
      app0.count < minCount0 || app0.count >= maxCount ||
      app1.count < minCount1 || app1.count >= maxCount
    ) {
      return false
    }

    // most_occurent_contig: contig in the pair with highest count
    let maxApp = -1
    let mostOccurent: string | null = null
    for (const [contig, app] of contigApps) {
      const isInPair = contig === nb.contigs[0] || contig === nb.contigs[1]
      if (isInPair && app.count >= maxApp) {
        maxApp = app.count
        mostOccurent = contig
      } else if (!isInPair && app.count > maxApp) {
        maxApp = app.count
        mostOccurent = contig
      }
    }

    if (mostOccurent !== nb.contigs[0] && mostOccurent !== nb.contigs[1]) {
      return false
    }

    if (contigApps.size === 2) return true

    // size == 3: check for small contig
    function checkSmall(idx: 0 | 1): boolean {
      const contig = nb.contigs[idx]
      const contigGenes = contigGeneMap.get(contig) ?? []
      const geneCount = contigGenes.length
      const app = contigApps.get(contig)!
      if (geneCount >= 1 && geneCount < nb.iteration + 3) {
        if (app.count === geneCount) return true
      }
      return false
    }

    if (contigApps.size === 3 && (checkSmall(0) || checkSmall(1))) {
      return true
    }

    return false
  }

  // -------------------------------------------------------------------------
  // refine_contig_neighbours — union-find style component tracking
  // -------------------------------------------------------------------------
  const refinedContigs: ContigNeighbour[] = []
  const contigEnds: ContigEnds = {}

  // setup_contig_max_iteration
  let contigCount = 0
  const contigMaxIteration = new Map<string, [number, number]>() // contig -> [component, maxIter]
  const componentsOfContigs = new Map<number, string[]>()

  for (const contig of contigGeneMap.keys()) {
    contigMaxIteration.set(contig, [contigCount, 0])
    componentsOfContigs.set(contigCount, [contig])
    contigCount++
  }

  const sortedNeighbours = [...neighbours].sort((a, b) => a.iteration - b.iteration)

  for (const nb of sortedNeighbours) {
    if (!checkIfConnectionIsValid(nb)) continue

    const c0 = nb.contigs[0]
    const c1 = nb.contigs[1]

    const info0 = contigMaxIteration.get(c0) ?? [0, 0]
    const info1 = contigMaxIteration.get(c1) ?? [0, 0]

    const comp0 = info0[0]
    const comp1 = info1[0]

    const minComp = Math.min(comp0, comp1)
    const maxComp = Math.max(comp0, comp1)

    if (minComp === maxComp) {
      // Same component — only add if iteration <= both maxIters
      if (nb.iteration <= info0[1] && nb.iteration <= info1[1]) {
        refinedContigs.push(nb)
        const existing = componentsOfContigs.get(minComp) ?? []
        for (const c of [c0, c1]) {
          if (!existing.includes(c)) existing.push(c)
        }
        componentsOfContigs.set(minComp, existing)
      }
    } else {
      // Merge components
      refinedContigs.push(nb)
      contigMaxIteration.set(c0, [minComp, nb.iteration])
      contigMaxIteration.set(c1, [minComp, nb.iteration])
      const maxCompContigs = componentsOfContigs.get(maxComp) ?? []
      const minCompContigs = componentsOfContigs.get(minComp) ?? []
      for (const c of maxCompContigs) {
        minCompContigs.push(c)
        contigMaxIteration.set(c, [minComp, contigMaxIteration.get(c)?.[1] ?? 0])
      }
      componentsOfContigs.set(minComp, minCompContigs)
      componentsOfContigs.delete(maxComp)
    }
  }

  // ends_of_contigs: compute contig_ends for ALL original neighbours (not just refined)
  for (const nb of neighbours) {
    const contigApps = findContigAppearances(nb)
    const c0 = nb.contigs[0]
    const c1 = nb.contigs[1]

    if (!contigEnds[c0]) contigEnds[c0] = {}
    if (!contigEnds[c1]) contigEnds[c1] = {}

    contigEnds[c0][c1] = getQueryStartTuples(nb, contigApps, 0)
    contigEnds[c1][c0] = getQueryStartTuples(nb, contigApps, 1)
  }

  return { refined: refinedContigs, contigEnds }
}

// ---------------------------------------------------------------------------
// buildContigSubgraph
// ---------------------------------------------------------------------------

/**
 * Build a graphology UndirectedGraph from a ContigNeighbour list.
 * Port of ContigGraph.create_contig_subgraph().
 */
export function buildContigSubgraph(neighbours: ContigNeighbour[]): UndirectedGraph {
  const graph = new UndirectedGraph()

  for (const nb of neighbours) {
    const [c0, c1] = nb.contigs
    if (!graph.hasNode(c0)) graph.addNode(c0)
    if (!graph.hasNode(c1)) graph.addNode(c1)
    if (!graph.hasEdge(c0, c1)) {
      graph.addEdge(c0, c1)
    }
  }

  return graph
}

// ---------------------------------------------------------------------------
// removeExtraContigs
// ---------------------------------------------------------------------------

/**
 * Port of RemoveContigs.remove_extra_contigs().
 * 1. Remove nodes with degree > 2.
 * 2. Remove nodes with degree == 0.
 */
export function removeExtraContigs(graph: UndirectedGraph): UndirectedGraph {
  // Remove nodes with degree > 2 (modifying graph in place; collect first)
  const highDegree = graph.nodes().filter(n => graph.degree(n) > 2)
  for (const node of highDegree) {
    graph.dropNode(node)
  }

  // Remove isolated nodes (degree == 0)
  const isolated = graph.nodes().filter(n => graph.degree(n) === 0)
  for (const node of isolated) {
    graph.dropNode(node)
  }

  return graph
}
