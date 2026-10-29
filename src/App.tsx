import { useState, useCallback, useEffect } from 'react'
import { saveAs } from 'file-saver'
import './App.css'

import { FileUpload } from './components/FileUpload'
import { LogConsole } from './components/LogConsole'
import { ContigGraph } from './components/ContigGraph'
import { StatsPanel } from './components/StatsPanel'
import { AboutPage } from './components/AboutPage'

import { runMadansix } from './madansix/pipeline'
import type { ScaffoldResult, FastaRecord } from './madansix/types'

// ─── Types ──────────────────────────────────────────────────────────────────

type Theme = 'light' | 'dark'
type View = 'analysis' | 'howItWorks' | 'about'
type Status = 'idle' | 'running' | 'done' | 'error'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resultToFasta(sequences: FastaRecord[]): string {
  return sequences.map(r => `>${r.name}\n${r.sequence}`).join('\n')
}

// ─── Moon / Sun icons ────────────────────────────────────────────────────────

const MoonIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
  </svg>
)

const SunIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorksPage() {
  return (
    <div className="how-it-works">
      <h2 className="section-heading">How It Works</h2>
      <p className="how-it-works-intro">
        madansix uses pan-genome gene synteny to reorder and reorient fragmented bacterial
        genome assembly contigs into longer, more contiguous scaffolds — entirely in your browser.
      </p>

      <div className="algorithm-steps">
        <div className="algorithm-step">
          <div className="algorithm-step-number">1</div>
          <div className="algorithm-step-content">
            <h3>Upload your files</h3>
            <p>
              Provide three inputs: your assembly FASTA (the fragmented genome you want to
              scaffold), a pan-genome reference FASTA (containing all known genes for the
              species), and a Roary pan-genome graph in DOT format (which encodes gene
              co-occurrence and synteny).
            </p>
          </div>
        </div>

        <div className="algorithm-step">
          <div className="algorithm-step-number">2</div>
          <div className="algorithm-step-content">
            <h3>Gene alignment with minimap2</h3>
            <p>
              minimap2 (compiled to WebAssembly) aligns each pan-genome gene sequence against
              your assembly contigs. This maps genes onto contigs and determines their
              orientation (forward or reverse complement).
            </p>
          </div>
        </div>

        <div className="algorithm-step">
          <div className="algorithm-step-number">3</div>
          <div className="algorithm-step-content">
            <h3>Synteny-guided ordering</h3>
            <p>
              Using the Roary pan-genome graph, the algorithm identifies which contigs share
              neighbouring genes. An iterative graph expansion finds contigs that are likely
              adjacent in the true genome sequence, establishing their relative order and
              orientation.
            </p>
          </div>
        </div>

        <div className="algorithm-step">
          <div className="algorithm-step-number">4</div>
          <div className="algorithm-step-content">
            <h3>Scaffold assembly</h3>
            <p>
              Contigs are reordered and reoriented based on the synteny evidence. Consecutive
              contigs are joined with 200-N gap sequences, producing a scaffolded FASTA output
              with fewer, longer sequences.
            </p>
          </div>
        </div>
      </div>

      <div className="algorithm-diagram">
        <pre className="algorithm-ascii">{`
  Assembly FASTA       Pan-genome FASTA    Roary DOT graph
  ┌──────────────┐     ┌──────────────┐   ┌──────────────┐
  │ contig_1     │     │ gene_A       │   │  geneA--geneB│
  │ contig_2     │     │ gene_B       │   │  geneB--geneC│
  │ contig_3     │     │ gene_C ...   │   │  ...         │
  └──────┬───────┘     └──────┬───────┘   └──────┬───────┘
         │                    │                   │
         └──────────┬──────────┘                  │
                    ▼                             │
          minimap2 (WebAssembly)                  │
          genes → contigs                         │
                    │                             │
                    └─────────────┬───────────────┘
                                  ▼
                       synteny graph expansion
                       (find adjacent contigs)
                                  │
                                  ▼
              ┌─────────────────────────────────────┐
              │ scaffold_1 = contig_2 + NNN + contig_1│
              │ scaffold_2 = contig_3                  │
              └─────────────────────────────────────┘
                                  │
                           ┌──────┴──────┐
                           ▼             ▼
                    FASTA output    Graph DOT
`}</pre>
      </div>

      <div className="how-it-works-note">
        <p>
          <strong>Based on <a href="https://github.com/andrewjpage/madansi" target="_blank" rel="noopener noreferrer">madansi</a></strong>{' '}
          — original tool by Joanna Tumelty and Andrew Page, Wellcome Sanger Institute.
        </p>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  // Theme
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('gx-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('gx-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Navigation
  const [view, setView] = useState<View>('analysis')

  // File state
  const [assemblyFile, setAssemblyFile] = useState<File | null>(null)
  const [panGenomeFile, setPanGenomeFile] = useState<File | null>(null)
  const [graphFile, setGraphFile] = useState<File | null>(null)

  // Pipeline state
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<ScaffoldResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const allFilesReady = assemblyFile !== null && panGenomeFile !== null && graphFile !== null
  const isRunning = status === 'running'

  const handleRun = useCallback(async () => {
    if (!assemblyFile || !panGenomeFile || !graphFile) return

    setStatus('running')
    setLogs([])
    setResult(null)
    setErrorMsg(null)
    setProgress(0)
    setProgressMsg('Starting…')

    const onProgress = (msg: string, pct: number) => {
      setProgressMsg(msg)
      setProgress(pct)
    }

    const onLog = (msg: string) => {
      setLogs(prev => [...prev, msg])
    }

    try {
      const r = await runMadansix(assemblyFile, panGenomeFile, graphFile, onProgress, onLog)
      setResult(r)
      setStatus('done')
      setProgress(100)
      setProgressMsg('Done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
      setStatus('error')
    }
  }, [assemblyFile, panGenomeFile, graphFile])

  const handleDownloadFasta = useCallback(() => {
    if (!result) return
    const text = resultToFasta(result.sequences)
    const blob = new Blob([text], { type: 'text/plain' })
    saveAs(blob, 'madansix_output.fa')
  }, [result])

  const handleDownloadDot = useCallback(() => {
    if (!result) return
    const blob = new Blob([result.dotGraph], { type: 'text/plain' })
    saveAs(blob, 'contig_graph.dot')
  }, [result])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1 className="app-title">
            <span className="app-title-accent">madan</span>six
          </h1>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            type="button"
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
        <p className="subtitle">Contig Scaffolding via Pan-Genome Synteny</p>
        <nav className="tab-bar" aria-label="Main navigation">
          <button
            className={`tab-btn${view === 'analysis' ? ' tab-btn--active' : ''}`}
            onClick={() => setView('analysis')}
            aria-current={view === 'analysis' ? 'page' : undefined}
            type="button"
          >
            Analysis
          </button>
          <button
            className={`tab-btn${view === 'howItWorks' ? ' tab-btn--active' : ''}`}
            onClick={() => setView('howItWorks')}
            aria-current={view === 'howItWorks' ? 'page' : undefined}
            type="button"
          >
            How it Works
          </button>
          <button
            className={`tab-btn${view === 'about' ? ' tab-btn--active' : ''}`}
            onClick={() => setView('about')}
            aria-current={view === 'about' ? 'page' : undefined}
            type="button"
          >
            About
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === 'analysis' && (
          <div className="analysis-view">
            {/* File upload */}
            <FileUpload
              assemblyFile={assemblyFile}
              panGenomeFile={panGenomeFile}
              graphFile={graphFile}
              onAssemblyChange={setAssemblyFile}
              onPanGenomeChange={setPanGenomeFile}
              onGraphChange={setGraphFile}
              disabled={isRunning}
            />

            {/* Run button */}
            <div className="run-bar">
              <button
                className="btn-run"
                onClick={handleRun}
                disabled={!allFilesReady || isRunning}
                type="button"
                aria-busy={isRunning}
              >
                {isRunning ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Running…
                  </>
                ) : (
                  <>&#9654; Run Scaffolding</>
                )}
              </button>
              {!allFilesReady && status === 'idle' && (
                <p className="run-hint">Upload all three files to enable scaffolding.</p>
              )}
            </div>

            {/* Progress */}
            {isRunning && (
              <div className="progress-area">
                <div className="progress-bar-wrap" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="progress-msg">{progressMsg}</p>
                <LogConsole lines={logs} />
              </div>
            )}

            {/* Error state */}
            {status === 'error' && (
              <div className="error-area">
                <div className="error-box" role="alert">
                  <strong>Error:</strong> {errorMsg}
                </div>
                <LogConsole lines={logs} />
              </div>
            )}

            {/* Done state */}
            {status === 'done' && result && (
              <div className="results-area">
                <div className="results-layout">
                  <StatsPanel stats={result.stats} />
                  <ContigGraph edges={result.edges} />
                </div>
                <div className="download-bar">
                  <button
                    className="btn-download"
                    onClick={handleDownloadFasta}
                    type="button"
                  >
                    &#8595; Download FASTA
                  </button>
                  <button
                    className="btn-download btn-download--secondary"
                    onClick={handleDownloadDot}
                    type="button"
                  >
                    &#8595; Download Graph DOT
                  </button>
                </div>
                <details className="log-details">
                  <summary>View run log</summary>
                  <LogConsole lines={logs} />
                </details>
              </div>
            )}
          </div>
        )}

        {view === 'howItWorks' && <HowItWorksPage />}
        {view === 'about' && <AboutPage />}
      </main>

      <footer className="app-footer">
        <p>
          madansix &mdash; browser-based contig scaffolding &mdash;{' '}
          <a
            href="https://github.com/genomicx/madansix"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
