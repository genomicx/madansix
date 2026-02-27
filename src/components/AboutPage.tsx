const ShieldIcon = () => (
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
    style={{ verticalAlign: 'middle', marginRight: '0.4rem' }}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const ExternalLinkIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ verticalAlign: 'middle', marginLeft: '0.25rem' }}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

export function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-section">
        <h2 className="about-heading">About madansix</h2>
        <p className="about-description">
          madansix reorders and reorients fragmented bacterial genome assembly contigs using
          pan-genome gene synteny. Upload your assembly FASTA, pan-genome FASTA, and Roary DOT
          graph to scaffold your assembly in your browser.
        </p>
      </section>

      <section className="about-section about-privacy">
        <p className="about-privacy-note">
          <ShieldIcon />
          <strong>No data leaves your machine.</strong> All computation runs locally in your
          browser via WebAssembly. Your sequences are never uploaded to any server.
        </p>
      </section>

      <section className="about-section">
        <h2 className="about-heading">Source Code</h2>
        <div className="about-reference">
          <div className="about-links">
            <a
              href="https://github.com/andrewjpage/madansi"
              target="_blank"
              rel="noopener noreferrer"
              className="about-link"
            >
              madansi on GitHub
              <ExternalLinkIcon />
            </a>
            <a
              href="https://github.com/andrewjpage/madansix"
              target="_blank"
              rel="noopener noreferrer"
              className="about-link"
            >
              madansix on GitHub
              <ExternalLinkIcon />
            </a>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2 className="about-heading">Authors</h2>
        <ul className="about-authors">
          <li className="about-author">
            <div className="about-author-name">Joanna Tumelty</div>
            <div className="about-author-role">
              Original madansi tool author &mdash; Research Software Engineer,{' '}
              <a
                href="https://www.sanger.ac.uk/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Wellcome Sanger Institute
              </a>
            </div>
          </li>
          <li className="about-author">
            <div className="about-author-name">Andrew Page</div>
            <div className="about-author-role">
              Web app author &mdash;{' '}
              <a
                href="https://github.com/andrewjpage"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/andrewjpage
              </a>
            </div>
          </li>
        </ul>
      </section>
    </div>
  )
}
