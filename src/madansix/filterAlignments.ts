import type { PafHit, Gene, SequenceMap } from './types'

/**
 * Quality filter: keep hits with mapq >= 20 AND residueMatches >= 100.
 * Port of FilterBlastComparison filter() (bit_score>=250 → mapq>=20 + residueMatches>=100).
 */
export function filterHits(hits: PafHit[]): PafHit[] {
  return hits.filter(h => h.mapq >= 20 && h.residueMatches >= 100)
}

/**
 * Find gene names that map to >= 3 distinct contigs (paralogs).
 * Port of FilterBlastComparison.find_gene_duplicates().
 *
 * In PAF convention: queryName = contig, targetName = gene.
 * A gene is a paralog if it appears on >=3 different contigs.
 */
export function findParalogGenes(hits: PafHit[]): Set<string> {
  // gene -> set of contigs it maps to
  const geneContigs = new Map<string, Set<string>>()

  for (const hit of hits) {
    const gene = hit.targetName
    const contig = hit.queryName
    if (!geneContigs.has(gene)) {
      geneContigs.set(gene, new Set())
    }
    geneContigs.get(gene)!.add(contig)
  }

  const paralogs = new Set<string>()
  for (const [gene, contigs] of geneContigs) {
    if (contigs.size >= 3) {
      paralogs.add(gene)
    }
  }
  return paralogs
}

/**
 * Build a gene -> contig map.
 * Only keeps the best-quality hit per gene (by residueMatches descending).
 * Port of GenesToContig.genes_to_contig().
 *
 * In PAF: queryName = contig, targetName = gene.
 */
export function buildGeneContigMap(
  hits: PafHit[],
  paralogGenes: Set<string>,
): Map<string, string> {
  // gene -> best hit so far
  const bestHit = new Map<string, PafHit>()

  for (const hit of hits) {
    const gene = hit.targetName
    if (paralogGenes.has(gene)) continue

    const existing = bestHit.get(gene)
    if (!existing || hit.residueMatches > existing.residueMatches) {
      bestHit.set(gene, hit)
    }
  }

  const map = new Map<string, string>()
  for (const [gene, hit] of bestHit) {
    map.set(gene, hit.queryName)
  }
  return map
}

/**
 * Build a contig -> Gene[] map.
 * Port of GeneDetector.contigs_to_genes().
 *
 * For each contig present in sequences, collect all (non-paralog) genes that map to it.
 * Orientation: if strand is '+' → 1, else → -1.
 * queryStart/queryEnd are positions on the contig.
 */
export function buildContigGeneMap(
  hits: PafHit[],
  sequences: SequenceMap,
  paralogGenes: Set<string>,
): Map<string, Gene[]> {
  // Initialise every contig with an empty list
  const map = new Map<string, Gene[]>()
  for (const contigName of sequences.keys()) {
    map.set(contigName, [])
  }

  // Track the best hit per (contig, gene) pair by residueMatches
  // gene name is targetName; contig is queryName
  type HitKey = string
  const bestPerContigGene = new Map<HitKey, PafHit>()

  for (const hit of hits) {
    const gene = hit.targetName
    const contig = hit.queryName
    if (paralogGenes.has(gene)) continue
    if (!sequences.has(contig)) continue

    const key: HitKey = `${contig}\x00${gene}`
    const existing = bestPerContigGene.get(key)
    if (!existing || hit.residueMatches > existing.residueMatches) {
      bestPerContigGene.set(key, hit)
    }
  }

  // Convert best hits to Gene objects
  // Track which gene names have already been added per contig to avoid duplicates
  const addedPerContig = new Map<string, Set<string>>()

  for (const [, hit] of bestPerContigGene) {
    const gene = hit.targetName
    const contigName = hit.queryName

    if (!addedPerContig.has(contigName)) {
      addedPerContig.set(contigName, new Set())
    }
    const addedGenes = addedPerContig.get(contigName)!
    if (addedGenes.has(gene)) continue
    addedGenes.add(gene)

    const orientation: 1 | -1 = hit.strand === '+' ? 1 : -1

    const geneObj: Gene = {
      name: gene,
      contigName,
      orientation,
      queryStart: hit.queryStart,
      queryEnd: hit.queryEnd,
    }

    const list = map.get(contigName)
    if (list !== undefined) {
      list.push(geneObj)
    } else {
      map.set(contigName, [geneObj])
    }
  }

  return map
}
