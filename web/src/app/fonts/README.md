# Fonts

Self-hosted variable fonts, so neither visitors nor builds contact Google or any CDN.

- Fraunces, Inter Tight and JetBrains Mono, under the SIL Open Font License 1.1 (`OFL-*.txt`).
- Files come from the `@fontsource-variable/*` npm packages: the `latin` and `latin-ext`
  subsets (English, Turkish, German). `fonts.css` maps each to its unicode range.
- To change a font: copy the new `.woff2` files here and update `fonts.css`; the family names
  are referenced by `--font-sans`, `--font-serif` and `--font-mono` in `globals.css`.
