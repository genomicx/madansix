import type { FastaRecord, SequenceMap } from './types'

/**
 * Parse a FASTA-format string into an array of FastaRecord objects.
 * Handles multi-line sequences and ignores blank lines within sequences.
 */
export function parseFasta(text: string): FastaRecord[] {
  const records: FastaRecord[] = []
  let currentName = ''
  let currentSeqParts: string[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.startsWith('>')) {
      if (currentName !== '') {
        records.push({ name: currentName, sequence: currentSeqParts.join('') })
      }
      // Take only the first word as the sequence name (like SeqIO.id)
      currentName = line.slice(1).trim().split(/\s+/)[0] ?? ''
      currentSeqParts = []
    } else if (line.length > 0 && currentName !== '') {
      currentSeqParts.push(line.trim())
    }
  }

  if (currentName !== '') {
    records.push({ name: currentName, sequence: currentSeqParts.join('') })
  }

  return records
}

const COMPLEMENT: Record<string, string> = {
  A: 'T', T: 'A', G: 'C', C: 'G',
  a: 't', t: 'a', g: 'c', c: 'g',
  N: 'N', n: 'n',
  R: 'Y', Y: 'R', S: 'S', W: 'W', K: 'M', M: 'K',
  B: 'V', V: 'B', D: 'H', H: 'D',
  r: 'y', y: 'r', s: 's', w: 'w', k: 'm', m: 'k',
  b: 'v', v: 'b', d: 'h', h: 'd',
}

/**
 * Return the reverse complement of a DNA/RNA sequence.
 * Unknown characters are kept as-is.
 */
export function reverseComplement(seq: string): string {
  const arr = new Array<string>(seq.length)
  for (let i = 0; i < seq.length; i++) {
    const ch = seq[seq.length - 1 - i]!
    arr[i] = COMPLEMENT[ch] ?? ch
  }
  return arr.join('')
}

/**
 * Build a SequenceMap from an array of FASTA records.
 * Returns Map<name, [forward, reverseComplement, length]>
 */
export function buildSequenceMap(records: FastaRecord[]): SequenceMap {
  const map: SequenceMap = new Map()
  for (const record of records) {
    map.set(record.name, [
      record.sequence,
      reverseComplement(record.sequence),
      record.sequence.length,
    ])
  }
  return map
}
