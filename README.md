# madansix

> Contig Scaffolding via Pan-Genome Synteny — in your browser

madansix is a browser-based implementation of [madansi](https://github.com/sanger-pathogens/madansi), reordering and reorienting fragmented bacterial genome assembly contigs using pan-genome gene synteny.

## Features

- Pan-genome guided contig scaffolding
- Minimap2 alignment via WebAssembly (biowasm)
- Interactive contig connectivity visualisation (D3.js)
- Before/after N50 statistics
- Client-side processing — no data leaves your browser

## Usage

1. Upload your assembly FASTA
2. Upload your pan-genome reference FASTA (from Roary)
3. Upload your pan-genome graph (.dot, from Roary)
4. Click **Run Scaffolding**
5. Download the reordered assembly FASTA

## Development

```bash
npm install
npm run dev
```

## Testing

```bash
npm run test         # unit tests
npx playwright test  # E2E tests
```

## Docker

```bash
docker build -t madansix .
docker run -p 8080:80 madansix
```

## Credits

- Original madansi tool: [Joanna Tumelty](https://github.com/sanger-pathogens/madansi), Wellcome Sanger Institute
- Web app: [Nabil-Fareed Alikhan](https://www.happykhan.com)

## Citation

Tumelty, J. et al. (2021). madansi: Microbial Assembly De-novo And Scaffolding In Silico.

## License

GPL-3.0-only
