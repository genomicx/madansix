import { useEffect, useRef, useState } from 'react'

interface LogConsoleProps {
  lines: string[]
}

export function LogConsole({ lines }: LogConsoleProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const el = bodyRef.current
    if (el) {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      if (isNearBottom) el.scrollTop = el.scrollHeight
    }
  }, [lines])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available — silently ignore
    }
  }

  return (
    <div className="log-console">
      <div className="log-header">
        <span className="log-title">Log Output</span>
        <button
          className="log-copy-btn"
          onClick={handleCopy}
          aria-label="Copy log to clipboard"
          type="button"
          disabled={lines.length === 0}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="log-body" ref={bodyRef} aria-live="polite" aria-label="Log console">
        {lines.length === 0 ? (
          <div className="log-empty">No log output yet.</div>
        ) : (
          lines.map((line, i) => (
            <div className="log-line" key={i}>
              <span className="log-index">{i + 1}</span>
              <span className="log-text">{line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
