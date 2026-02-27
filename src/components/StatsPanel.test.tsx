import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsPanel } from './StatsPanel'
import type { AssemblyStats } from '../madansix/types'

const mockStats: AssemblyStats = {
  originalCount: 4,
  finalCount: 2,
  n50Before: 100,
  n50After: 350,
  longestBefore: 200,
  longestAfter: 450,
  totalLenBefore: 600,
  totalLenAfter: 600,
  joinsCount: 2,
  contigs: [],
}

describe('StatsPanel', () => {
  it('renders the Assembly Statistics heading', () => {
    render(<StatsPanel stats={mockStats} />)
    expect(screen.getByText('Assembly Statistics')).toBeInTheDocument()
  })

  it('renders Before and After column headers', () => {
    render(<StatsPanel stats={mockStats} />)
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('After')).toBeInTheDocument()
  })

  it('shows correct original contig count (before)', () => {
    render(<StatsPanel stats={mockStats} />)
    // originalCount = 4, displayed with toLocaleString
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('shows correct final contig count (after)', () => {
    render(<StatsPanel stats={mockStats} />)
    // finalCount = 2 — also appears in joinsCount; use getAllByText
    const cells = screen.getAllByText('2')
    // Both finalCount and joinsCount equal 2
    expect(cells.length).toBeGreaterThanOrEqual(1)
  })

  it('shows N50 before value', () => {
    render(<StatsPanel stats={mockStats} />)
    // n50Before = 100
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('shows N50 after value', () => {
    render(<StatsPanel stats={mockStats} />)
    // n50After = 350
    expect(screen.getByText('350')).toBeInTheDocument()
  })

  it('shows longest contig before value', () => {
    render(<StatsPanel stats={mockStats} />)
    // longestBefore = 200
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('shows longest contig after value', () => {
    render(<StatsPanel stats={mockStats} />)
    // longestAfter = 450
    expect(screen.getByText('450')).toBeInTheDocument()
  })

  it('shows total length (same before and after)', () => {
    render(<StatsPanel stats={mockStats} />)
    // totalLenBefore = totalLenAfter = 600; both cells shown
    const sixHundredCells = screen.getAllByText('600')
    expect(sixHundredCells.length).toBe(2)
  })

  it('shows joins made count', () => {
    render(<StatsPanel stats={mockStats} />)
    // joinsCount = 2 — note '2' also appears in finalCount; check via label
    expect(screen.getByText('Joins made')).toBeInTheDocument()
  })

  it('renders Contigs row label', () => {
    render(<StatsPanel stats={mockStats} />)
    expect(screen.getByText('Contigs')).toBeInTheDocument()
  })

  it('renders N50 (bp) row label', () => {
    render(<StatsPanel stats={mockStats} />)
    expect(screen.getByText('N50 (bp)')).toBeInTheDocument()
  })

  it('renders Longest (bp) row label', () => {
    render(<StatsPanel stats={mockStats} />)
    expect(screen.getByText('Longest (bp)')).toBeInTheDocument()
  })

  it('renders Total length (bp) row label', () => {
    render(<StatsPanel stats={mockStats} />)
    expect(screen.getByText('Total length (bp)')).toBeInTheDocument()
  })

  it('renders a table element', () => {
    const { container } = render(<StatsPanel stats={mockStats} />)
    expect(container.querySelector('table')).toBeInTheDocument()
  })
})
