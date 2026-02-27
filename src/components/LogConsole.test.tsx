import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LogConsole } from './LogConsole'

describe('LogConsole', () => {
  it('shows "No log output yet." message when lines is empty', () => {
    render(<LogConsole lines={[]} />)
    expect(screen.getByText('No log output yet.')).toBeInTheDocument()
  })

  it('renders log lines correctly', () => {
    const lines = ['Line 1: Starting pipeline', 'Line 2: Parsing FASTA', 'Line 3: Done']
    render(<LogConsole lines={lines} />)

    expect(screen.getByText('Line 1: Starting pipeline')).toBeInTheDocument()
    expect(screen.getByText('Line 2: Parsing FASTA')).toBeInTheDocument()
    expect(screen.getByText('Line 3: Done')).toBeInTheDocument()
  })

  it('shows correct line count (line numbers)', () => {
    const lines = ['First line', 'Second line', 'Third line']
    render(<LogConsole lines={lines} />)

    // Line numbers should be rendered (1, 2, 3)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders the Copy button', () => {
    render(<LogConsole lines={['some log']} />)
    expect(screen.getByRole('button', { name: /copy log to clipboard/i })).toBeInTheDocument()
  })

  it('Copy button is disabled when lines is empty', () => {
    render(<LogConsole lines={[]} />)
    const copyBtn = screen.getByRole('button', { name: /copy log to clipboard/i })
    expect(copyBtn).toBeDisabled()
  })

  it('Copy button is enabled when lines are present', () => {
    render(<LogConsole lines={['some log output']} />)
    const copyBtn = screen.getByRole('button', { name: /copy log to clipboard/i })
    expect(copyBtn).not.toBeDisabled()
  })

  it('renders the log console container', () => {
    const { container } = render(<LogConsole lines={['hello']} />)
    expect(container.querySelector('.log-console')).toBeInTheDocument()
  })

  it('renders "Log Output" title', () => {
    render(<LogConsole lines={[]} />)
    expect(screen.getByText('Log Output')).toBeInTheDocument()
  })
})
