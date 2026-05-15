#!/usr/bin/env node
// Rebuild registry/data-table.json by re-inlining file content from src/.
// Top-level metadata (dependencies, cssVars, docs, description, etc.)
// is preserved from the existing registry — only the `files` array is
// regenerated. Add a file: extend FILE_MAP below + run `node scripts/build-registry.mjs`.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY_PATH = resolve(REPO_ROOT, 'registry/data-table.json')

// [registry path (consumer-side install location), source path (this repo), shadcn type]
const FILE_MAP = [
  ['components/ui/data-table.tsx',          'src/components/data-table.tsx',          'registry:ui'],
  ['components/ui/data-table-bulk-ctx.ts',  'src/components/data-table-bulk-ctx.ts',  'registry:ui'],
  ['components/ui/find-bar.tsx',            'src/components/find-bar.tsx',            'registry:ui'],
  ['components/ui/button.tsx',              'src/components/ui/button.tsx',           'registry:ui'],
  ['components/ui/checkbox.tsx',            'src/components/ui/checkbox.tsx',         'registry:ui'],
  ['components/ui/context-menu.tsx',        'src/components/ui/context-menu.tsx',     'registry:ui'],
  ['components/ui/dropdown-menu.tsx',       'src/components/ui/dropdown-menu.tsx',    'registry:ui'],
  ['components/ui/empty-state.tsx',         'src/components/ui/empty-state.tsx',      'registry:ui'],
  ['components/ui/popover.tsx',             'src/components/ui/popover.tsx',          'registry:ui'],
  ['components/ui/segmented-control.tsx',   'src/components/ui/segmented-control.tsx','registry:ui'],
  ['components/ui/sheet.tsx',               'src/components/ui/sheet.tsx',            'registry:ui'],
  ['components/ui/skeleton.tsx',            'src/components/ui/skeleton.tsx',         'registry:ui'],
  ['components/ui/sparkline.tsx',           'src/components/ui/sparkline.tsx',        'registry:ui'],
  ['hooks/use-table-prefs.ts',              'src/hooks/use-table-prefs.ts',           'registry:hook'],
  ['hooks/cross-table-vis.ts',              'src/hooks/cross-table-vis.ts',           'registry:hook'],
  ['lib/cn.ts',                             'src/lib/cn.ts',                          'registry:lib'],
  ['lib/icons.tsx',                         'src/lib/icons.tsx',                      'registry:lib'],
  ['styles/data-table.css',                 'src/styles/data-table.css',              'registry:style'],
]

const existing = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'))

const files = FILE_MAP.map(([path, source, type]) => ({
  path,
  type,
  content: readFileSync(resolve(REPO_ROOT, source), 'utf8'),
}))

const out = {
  ...existing,
  files,
}

writeFileSync(REGISTRY_PATH, JSON.stringify(out, null, 2) + '\n')

console.log(`registry rebuilt: ${files.length} files, ${(JSON.stringify(out).length / 1024).toFixed(1)}KB`)
