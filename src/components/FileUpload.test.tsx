import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileUpload } from './FileUpload'

function noop() {}

const defaultProps = {
  assemblyFile: null,
  panGenomeFile: null,
  graphFile: null,
  onAssemblyChange: noop,
  onPanGenomeChange: noop,
  onGraphChange: noop,
  disabled: false,
}

describe('FileUpload', () => {
  it('renders 3 upload zones', () => {
    render(<FileUpload {...defaultProps} />)

    // Each slot has a role="button" aria-label
    const uploadZones = screen.getAllByRole('button')
    // There are at least 3 upload slots
    expect(uploadZones.length).toBeGreaterThanOrEqual(3)
  })

  it('shows label text for Assembly FASTA zone', () => {
    render(<FileUpload {...defaultProps} />)
    expect(screen.getByText('Assembly FASTA')).toBeInTheDocument()
  })

  it('shows label text for Pan-genome FASTA zone', () => {
    render(<FileUpload {...defaultProps} />)
    expect(screen.getByText('Pan-genome FASTA')).toBeInTheDocument()
  })

  it('shows label text for Roary Graph .dot zone', () => {
    render(<FileUpload {...defaultProps} />)
    // The label may be "Roary Graph .dot" or "Graph .dot" depending on implementation
    expect(
      screen.getByText(/graph\s*\.dot/i) || screen.getByText(/roary graph/i),
    ).toBeInTheDocument()
  })

  it('shows filename when a file is selected for assembly', () => {
    const mockFile = new File(['ATCG'], 'assembly.fa', { type: 'text/plain' })
    render(
      <FileUpload
        {...defaultProps}
        assemblyFile={mockFile}
      />,
    )
    expect(screen.getByText('assembly.fa')).toBeInTheDocument()
  })

  it('shows filename when a file is selected for pan-genome', () => {
    const mockFile = new File(['ATCG'], 'pangenome.fa', { type: 'text/plain' })
    render(
      <FileUpload
        {...defaultProps}
        panGenomeFile={mockFile}
      />,
    )
    expect(screen.getByText('pangenome.fa')).toBeInTheDocument()
  })

  it('shows filename when a graph file is selected', () => {
    const mockFile = new File(['graph'], 'graph.dot', { type: 'text/plain' })
    render(
      <FileUpload
        {...defaultProps}
        graphFile={mockFile}
      />,
    )
    expect(screen.getByText('graph.dot')).toBeInTheDocument()
  })

  it('all upload slots have aria-disabled=true when disabled=true', () => {
    render(<FileUpload {...defaultProps} disabled={true} />)

    const uploadSlots = screen.getAllByRole('button')
    const uploadSlotsDivs = uploadSlots.filter(
      el => el.getAttribute('aria-label')?.startsWith('Upload'),
    )
    for (const slot of uploadSlotsDivs) {
      expect(slot).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('hidden file inputs are disabled when disabled=true', () => {
    const { container } = render(<FileUpload {...defaultProps} disabled={true} />)
    const fileInputs = container.querySelectorAll('input[type="file"]')
    expect(fileInputs.length).toBe(3)
    for (const input of fileInputs) {
      expect(input).toBeDisabled()
    }
  })

  it('calls onAssemblyChange with null when remove button clicked', () => {
    const mockFile = new File(['ATCG'], 'assembly.fa', { type: 'text/plain' })
    const onAssemblyChange = vi.fn()

    render(
      <FileUpload
        {...defaultProps}
        assemblyFile={mockFile}
        onAssemblyChange={onAssemblyChange}
      />,
    )

    const removeBtn = screen.getByRole('button', { name: /remove assembly fasta file/i })
    fireEvent.click(removeBtn)
    expect(onAssemblyChange).toHaveBeenCalledWith(null)
  })
})
