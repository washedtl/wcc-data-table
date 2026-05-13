import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Playground for the extracted wcc-data-table package — mirrors what a
// consumer's vite.config would look like after `npx shadcn add data-table`.
// The `@/` alias points at ../src (the package's source) during in-repo
// development; consumers' `@/` would instead point at their own src/ after
// the registry copies files into their project.
export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 6020,
    strictPort: true,
    fs: {
      // Need access to the sibling src/ folder — Vite blocks it by default
      // because it sits outside the playground's project root.
      allow: [path.resolve(__dirname, '..')],
    },
  },
})
