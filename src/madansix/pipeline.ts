/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ScaffoldResult, AssemblyStats, ContigJoinInfo } from './types'
import { parseFasta, buildSequenceMap } from './parseFasta'
import { parsePaf } from './parsePaf'
import { parseDot, filterPanGenomeGraph } from './parseDot'
import { filterHits, findParalogGenes, buildGeneContigMap, buildContigGeneMap } from './filterAlignments'
import { expandContigConnections, refineContigGraph, buildContigSubgraph, removeExtraContigs } from './contigGraph'
import { assembleOrderedFasta, computeN50, graphToDot, graphToEdges } from './outputFasta'

// Aioli is loaded via CDN in index.html
declare const Aioli: any

export type ProgressCallback = (msg: string, pct: number) => void
export type LogCallback = (msg: string) => void

// ---------------------------------------------------------------------------
// File reading helper
// ---------------------------------------------------------------------------

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsText(file)
  })
}

// ---------------------------------------------------------------------------
// runMadansix
// ---------------------------------------------------------------------------

export async function runMadansix(
  assemblyFile: File,
  panGenomeFile: File,
  graphFile: File,
  onProgress: ProgressCallback,
  onLog: LogCallback,
): Promise<ScaffoldResult> {

  // -------------------------------------------------------------------------
  // Step 1 (0–5%): Read input files
  // -------------------------------------------------------------------------
  onProgress('Reading input files…', 0)
  onLog(`Reading assembly: ${assemblyFile.name}`)
  onLog(`Reading pan-genome: ${panGenomeFile.name}`)
  onLog(`Reading graph: ${graphFile.name}`)

  const [assemblyText, panGenomeText, graphText] = await Promise.all([
    readFileAsText(assemblyFile),
    readFileAsText(panGenomeFile),
    readFileAsText(graphFile),
  ])

  onProgress('Input files loaded', 5)

  // -------------------------------------------------------------------------
  // Step 2 (5–10%): Parse FASTA + DOT
  // -------------------------------------------------------------------------
  onProgress('Parsing FASTA and graph files…', 5)
  onLog('Parsing assembly FASTA…')

  const assemblyRecords = parseFasta(assemblyText)
  onLog(`  → ${assemblyRecords.length} contig(s) found`)

  const sequences = buildSequenceMap(assemblyRecords)

  onLog('Parsing pan-genome graph (DOT)…')
  const unfilteredGraph = parseDot(graphText)
  onLog(`  → ${unfilteredGraph.nodes.length} nodes, ${unfilteredGraph.edges.length} edges`)

  const filteredGraph = filterPanGenomeGraph(unfilteredGraph)
  onLog(`  → After filtering: ${filteredGraph.edges.length} edges`)

  onProgress('Parsing complete', 10)

  // -------------------------------------------------------------------------
  // Step 3 (10–15%): Initialise Aioli/minimap2
  // -------------------------------------------------------------------------
  onProgress('Initialising minimap2 (Aioli/WebAssembly)…', 10)
  onLog('Loading minimap2 via Aioli…')

  const cli = await new Aioli(['minimap2/2.28'])
  onLog('  → minimap2 ready')

  onProgress('minimap2 initialised', 15)

  // -------------------------------------------------------------------------
  // Step 4 (15–70%): Run minimap2 alignment
  // -------------------------------------------------------------------------
  onProgress('Mounting files for alignment…', 15)
  onLog('Mounting sequences into virtual filesystem…')

  await cli.mount([
    { name: 'pan_genome.fa', data: panGenomeText },
    { name: 'assembly.fa', data: assemblyText },
  ])

  onProgress('Running minimap2 alignment…', 20)
  onLog('Running: minimap2 -x asm5 -c pan_genome.fa assembly.fa')

  const pafOutput: string = await cli.exec('minimap2 -x asm5 -c pan_genome.fa assembly.fa')
  onLog(`  → Alignment complete (${pafOutput.split('\n').filter(l => l.trim()).length} PAF lines)`)

  onProgress('Alignment complete', 70)

  // -------------------------------------------------------------------------
  // Step 5 (70–75%): Parse PAF + filter alignments
  // -------------------------------------------------------------------------
  onProgress('Parsing PAF and filtering alignments…', 70)
  onLog('Parsing PAF output…')

  const rawHits = parsePaf(pafOutput)
  onLog(`  → ${rawHits.length} raw hits`)

  const qualityHits = filterHits(rawHits)
  onLog(`  → ${qualityHits.length} hits after quality filter (mapq≥20, residueMatches≥100)`)

  const paralogGenes = findParalogGenes(qualityHits)
  onLog(`  → ${paralogGenes.size} paralog gene(s) removed`)

  const geneContigMap = buildGeneContigMap(qualityHits, paralogGenes)
  onLog(`  → ${geneContigMap.size} unique gene–contig mappings`)

  const contigGeneMap = buildContigGeneMap(qualityHits, sequences, paralogGenes)
  const contigsWithGenes = [...contigGeneMap.values()].filter(g => g.length > 0).length
  onLog(`  → ${contigsWithGenes} contig(s) with mapped genes`)

  onProgress('Alignments filtered', 75)

  // -------------------------------------------------------------------------
  // Step 6 (75–80%): Expand contig connections
  // -------------------------------------------------------------------------
  onProgress('Expanding contig connections…', 75)
  onLog('Running ContigSearching.expand_all_contigs()…')

  const neighbours = expandContigConnections(contigGeneMap, filteredGraph)
  onLog(`  → ${neighbours.length} contig neighbour pair(s) found`)

  onProgress('Contig connections expanded', 80)

  // -------------------------------------------------------------------------
  // Step 7 (80–85%): Refine contig graph
  // -------------------------------------------------------------------------
  onProgress('Refining contig graph…', 80)
  onLog('Running RefineContigNeighbours.refine_contig_neighbours()…')

  const { refined, contigEnds } = refineContigGraph(
    neighbours,
    filteredGraph,
    unfilteredGraph,
    geneContigMap,
    contigGeneMap,
    sequences,
  )
  onLog(`  → ${refined.length} refined contig pair(s)`)

  // Build graphology graphs from refined neighbours
  const refinedSubgraph = buildContigSubgraph(refined)

  // Remove high-degree (>2) and isolated nodes
  const cleanGraph = removeExtraContigs(refinedSubgraph)
  onLog(`  → Contig graph: ${cleanGraph.order} nodes, ${cleanGraph.size} edges`)

  onProgress('Contig graph refined', 85)

  // -------------------------------------------------------------------------
  // Step 8 (85–90%): Determine orientations + assemble FASTA
  // -------------------------------------------------------------------------
  onProgress('Assembling scaffolded sequences…', 85)
  onLog('Determining orientations and assembling FASTA…')

  const scaffoldedRecords = assembleOrderedFasta(
    cleanGraph,
    sequences,
    contigEnds,
    assemblyRecords,
  )
  onLog(`  → ${scaffoldedRecords.length} output sequence(s)`)

  onProgress('Sequences assembled', 90)

  // -------------------------------------------------------------------------
  // Step 9 (90–100%): Compute stats + finalize
  // -------------------------------------------------------------------------
  onProgress('Computing assembly statistics…', 90)
  onLog('Computing N50 and assembly stats…')

  const n50Before = computeN50(assemblyRecords.map(r => r.sequence.length))
  const n50After  = computeN50(scaffoldedRecords.map(r => r.sequence.length))

  const totalLenBefore = assemblyRecords.reduce((s, r) => s + r.sequence.length, 0)
  const totalLenAfter  = scaffoldedRecords.reduce((s, r) => s + r.sequence.length, 0)

  const longestBefore = assemblyRecords.reduce((m, r) => Math.max(m, r.sequence.length), 0)
  const longestAfter  = scaffoldedRecords.reduce((m, r) => Math.max(m, r.sequence.length), 0)

  // Count actual joins: edges in the clean graph represent joins
  const joinsCount = cleanGraph.size

  // Build contig join info for UI
  const contigJoinInfo: ContigJoinInfo[] = []
  for (const node of cleanGraph.nodes()) {
    const joinedWith = cleanGraph.neighbors(node)
    contigJoinInfo.push({ name: node, joinedWith })
  }

  const stats: AssemblyStats = {
    originalCount:  assemblyRecords.length,
    finalCount:     scaffoldedRecords.length,
    n50Before,
    n50After,
    longestBefore,
    longestAfter,
    totalLenBefore,
    totalLenAfter,
    joinsCount,
    contigs: contigJoinInfo,
  }

  onLog(`  N50: ${n50Before} → ${n50After}`)
  onLog(`  Sequences: ${assemblyRecords.length} → ${scaffoldedRecords.length}`)
  onLog(`  Joins made: ${joinsCount}`)

  const edges = graphToEdges(cleanGraph)
  const dotGraph = graphToDot(edges)

  onProgress('Pipeline complete', 100)
  onLog('Madansix pipeline finished successfully.')

  return {
    sequences: scaffoldedRecords,
    edges,
    stats,
    dotGraph,
  }
}
