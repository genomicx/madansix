import { useRef, useState, DragEvent, ChangeEvent } from 'react'

interface FileUploadProps {
  assemblyFile: File | null
  panGenomeFile: File | null
  graphFile: File | null
  onAssemblyChange: (f: File | null) => void
  onPanGenomeChange: (f: File | null) => void
  onGraphChange: (f: File | null) => void
  disabled: boolean
}

interface SlotProps {
  label: string
  accept: string
  file: File | null
  hint: string
  onChange: (f: File | null) => void
  disabled: boolean
}

const UploadIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const FileIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

function UploadSlot({ label, accept, file, hint, onChange, disabled }: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      const extensions = accept.split(',').map(ext => ext.trim().toLowerCase())
      const name = dropped.name.toLowerCase()
      const matched = extensions.some(ext => name.endsWith(ext))
      if (matched) onChange(dropped)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleClick = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    onChange(f)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const isFilled = file !== null
  const slotClass = [
    'file-upload-slot',
    isFilled ? 'file-upload-slot--filled' : '',
    dragOver ? 'file-upload-slot--drag-over' : '',
    disabled ? 'file-upload-slot--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={slotClass}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Upload ${label}`}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
        disabled={disabled}
        aria-hidden="true"
      />
      <div className="file-upload-slot-icon">
        {isFilled ? <FileIcon /> : <UploadIcon />}
      </div>
      <div className="file-upload-slot-label">{label}</div>
      {isFilled ? (
        <div className="file-upload-slot-filename" title={file.name}>
          {file.name}
        </div>
      ) : (
        <div className="file-upload-slot-hint">{hint}</div>
      )}
      {isFilled && !disabled && (
        <button
          className="file-upload-slot-clear"
          onClick={(e) => {
            e.stopPropagation()
            onChange(null)
          }}
          aria-label={`Remove ${label} file`}
          type="button"
        >
          &times;
        </button>
      )}
    </div>
  )
}

export function FileUpload({
  assemblyFile,
  panGenomeFile,
  graphFile,
  onAssemblyChange,
  onPanGenomeChange,
  onGraphChange,
  disabled,
}: FileUploadProps) {
  const fastaAccept = '.fa,.fasta,.fna,.fsa,.gz'
  const dotAccept = '.dot'

  return (
    <div className="file-upload-grid">
      <UploadSlot
        label="Assembly FASTA"
        accept={fastaAccept}
        file={assemblyFile}
        hint="Drop .fa / .fasta / .fna / .gz here or click to browse"
        onChange={onAssemblyChange}
        disabled={disabled}
      />
      <UploadSlot
        label="Pan-genome FASTA"
        accept={fastaAccept}
        file={panGenomeFile}
        hint="Drop .fa / .fasta / .fna / .gz here or click to browse"
        onChange={onPanGenomeChange}
        disabled={disabled}
      />
      <UploadSlot
        label="Roary Graph .dot"
        accept={dotAccept}
        file={graphFile}
        hint="Drop .dot file here or click to browse"
        onChange={onGraphChange}
        disabled={disabled}
      />
    </div>
  )
}
