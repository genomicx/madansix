/** A single FASTA record */
export interface FastaRecord {
  name: string
  sequence: string
}

/**
 * A single PAF alignment hit from minimap2.
 * PAF format: https://github.com/lh3/miniasm/blob/master/PAF.md
 * In madansix: query = assembly contig, target = pan-genome gene
 */
export interface PafHit {
  queryName: string
  queryLength: number
  queryStart: number
  queryEnd: number
  strand: '+' | '-'
  targetName: string
  targetLength: number
  targetStart: number
  targetEnd: number
  residueMatches: number
  alignmentLength: number
  mapq: number
}

/**
 * A gene mapped to a contig after alignment and filtering.
 * Equivalent to madansi's Gene object stored inside Contig.gene_objects.
 */
export interface Gene {
  name: string          // pan-genome gene name (targetName from PAF)
  contigName: string    // assembly contig it maps to
  orientation: 1 | -1  // 1 = forward, -1 = reverse
  queryStart: number    // start position on contig
  queryEnd: number      // end position on contig
}

/**
 * A pair of neighbouring contigs found via graph expansion.
 * Equivalent to an entry in ContigSearching.neighbouring_contigs:
 *   [sorted([c1, c2]), iteration_count, sorted(intersection_genes)]
 */
export interface ContigNeighbour {
  contigs: [string, string]    // sorted pair
  iteration: number            // expansion depth at which they met
  intersectionGenes: string[]  // gene names at intersection
}

/**
 * Contig ends data: for each contig, its position relative to each neighbour.
 * contig_ends[contigName][neighbourName] = [qry_start1, qry_start2 | null]
 */
export type ContigEnds = Record<string, Record<string, [number, number | null]>>

/**
 * A directed edge in the final contig connectivity graph.
 * Used for D3 visualisation and DOT export.
 */
export interface ContigEdge {
  source: string
  target: string
}

/**
 * Per-contig join info for the StatsPanel
 */
export interface ContigJoinInfo {
  name: string
  joinedWith: string[]
}

/** Assembly statistics before/after scaffolding */
export interface AssemblyStats {
  originalCount: number
  finalCount: number
  n50Before: number
  n50After: number
  longestBefore: number
  longestAfter: number
  totalLenBefore: number
  totalLenAfter: number
  joinsCount: number
  contigs: ContigJoinInfo[]
}

/** Full result from the madansix pipeline */
export interface ScaffoldResult {
  sequences: FastaRecord[]
  edges: ContigEdge[]
  stats: AssemblyStats
  dotGraph: string         // DOT format for download
}

/** Pan-genome gene graph (Graphviz DOT undirected graph) */
export interface PanGenomeGraph {
  nodes: string[]
  edges: [string, string][]
  weights: Map<string, number>   // "nodeA--nodeB" → weight
}

/**
 * Internal sequences map used in the pipeline.
 * sequences[contigName] = [forward, reverseComplement, length]
 */
export type SequenceMap = Map<string, [string, string, number]>
