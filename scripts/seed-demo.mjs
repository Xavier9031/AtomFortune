#!/usr/bin/env node
/**
 * Seed demo data into a running AtomFortune instance.
 * Creates 4 demo users and imports pre-built backup payloads via /backup/import.
 *
 * Usage: node scripts/seed-demo.mjs [API_URL]
 *   Default API_URL: http://localhost:8001/api/v1
 */

import { buildAllProfiles } from '../api/demo/profiles.mjs'

const API = process.argv[2] || 'http://localhost:8001/api/v1'

async function main() {
  console.log('=== AtomFortune Demo Seed ===\n')
  console.log(`API: ${API}\n`)

  const profiles = buildAllProfiles()
  console.log(`Generated ${profiles.length} profiles\n`)

  for (const { name, backup } of profiles) {
    // 1. Create user
    const userRes = await fetch(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!userRes.ok) {
      const text = await userRes.text()
      throw new Error(`Failed to create user "${name}": ${userRes.status} ${text}`)
    }
    const user = await userRes.json()

    // 2. Import backup as JSON (no zip needed)
    const importRes = await fetch(`${API}/backup/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
      body: JSON.stringify(backup),
    })
    if (!importRes.ok) {
      const text = await importRes.text()
      throw new Error(`Failed to import for "${name}": ${importRes.status} ${text}`)
    }
    const result = await importRes.json()

    const d = result.imported
    console.log(`  ✓ ${name.padEnd(14)} (${user.id.slice(0, 8)}) — ${d.assets}a ${d.accounts}acc ${d.holdings}h ${d.transactions}tx ${d.prices}p ${d.snapshotItems}snap`)
  }

  console.log('\n=== Done! ===')
}

main().catch(err => {
  console.error(`\n❌ ${err.message}`)
  process.exit(1)
})
