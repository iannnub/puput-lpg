import fs from 'node:fs'
import path from 'node:path'

interface Finding {
  file: string
  line: number
  category: string
  detail: string
}

const findings: Finding[] = []

function scanDir(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        scanDir(fullPath)
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      scanFile(fullPath)
    }
  }
}

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const relPath = filePath.replace(/\\/g, '/')
  const isClientComponent = lines.slice(0, 5).some(l => l.includes("'use client'") || l.includes('"use client"'))

  lines.forEach((line, idx) => {
    const lineNum = idx + 1

    // 1. Auth calls
    if (line.includes('.auth.getUser(')) {
      findings.push({ file: relPath, line: lineNum, category: 'Auth Call', detail: 'supabase.auth.getUser() network call' })
    }
    if (line.includes('.auth.getSession(')) {
      findings.push({ file: relPath, line: lineNum, category: 'Auth Call', detail: 'supabase.auth.getSession()' })
    }
    if (line.includes('.auth.getClaims(')) {
      findings.push({ file: relPath, line: lineNum, category: 'Auth Call', detail: 'supabase.auth.getClaims()' })
    }

    // 2. Query to users table
    if (line.includes(".from('users')") || line.includes('.from("users")')) {
      findings.push({ file: relPath, line: lineNum, category: 'Users Table Query', detail: "Direct query to users table (role/profile check)" })
    }

    // 3. Client bundle heavy imports
    if (isClientComponent) {
      if (line.includes('@react-pdf/renderer')) {
        findings.push({ file: relPath, line: lineNum, category: 'Client Bundle Heavy', detail: "Client component imports @react-pdf/renderer" })
      }
      if (line.includes('exceljs')) {
        findings.push({ file: relPath, line: lineNum, category: 'Client Bundle Heavy', detail: "Client component imports exceljs" })
      }
      if (line.includes('jsonwebtoken')) {
        findings.push({ file: relPath, line: lineNum, category: 'Client Bundle Heavy', detail: "Client component imports jsonwebtoken" })
      }
      if (line.includes('browser-image-compression') && !line.includes('await import(')) {
        findings.push({ file: relPath, line: lineNum, category: 'Client Bundle Heavy', detail: "Static import of browser-image-compression in client component" })
      }
      if (line.includes('watch(') && !line.includes('useWatch') && !line.includes('watch(') && line.trim().startsWith('watch()')) {
        findings.push({ file: relPath, line: lineNum, category: 'RHF Watch Unscoped', detail: "watch() called without field name filter (causes re-render of entire form)" })
      }
    }

    // 4. Router refresh
    if (line.includes('router.refresh()')) {
      findings.push({ file: relPath, line: lineNum, category: 'Full Page Invalidation', detail: "router.refresh() triggers re-fetching of all server data on route" })
    }

    // 5. select('*')
    if (line.includes(".select('*')") || line.includes('.select("*")')) {
      findings.push({ file: relPath, line: lineNum, category: 'Overfetching', detail: "select('*') queries all columns" })
    }
  })
}

// Scan app, components, lib, middleware
scanDir('app')
scanDir('components')
scanDir('lib')
if (fs.existsSync('middleware.ts')) scanFile('middleware.ts')

// Generate markdown
let md = `# Inventori Kode & Analisis Bottleneck Performa\n\n`
md += `**Tanggal:** ${new Date().toISOString()}\n`
md += `**Total Temuan:** ${findings.length}\n\n`
md += `| File | Baris | Kategori | Detail Temuan |\n`
md += `| :--- | :--- | :--- | :--- |\n`

for (const f of findings) {
  md += `| \`${f.file}\` | ${f.line} | **${f.category}** | ${f.detail} |\n`
}

fs.mkdirSync('docs/perf', { recursive: true })
fs.writeFileSync('docs/perf/inventory.md', md)
console.log(`Generated docs/perf/inventory.md with ${findings.length} findings.`)
