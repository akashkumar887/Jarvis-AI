#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const HOME = homedir()
const PLIST_PATH = join(HOME, 'Library', 'LaunchAgents', 'com.jarvis.ai.plist')

console.log('Unloading J.A.R.V.I.S. background service...')
try {
  execSync(`launchctl unload -w "${PLIST_PATH}" 2>/dev/null || true`, { shell: '/bin/bash' })
  console.log('Unloaded from launchctl.')
} catch {}

if (existsSync(PLIST_PATH)) {
  unlinkSync(PLIST_PATH)
  console.log(`Removed ${PLIST_PATH}`)
}

try {
  execSync('lsof -ti :5173 -ti :8787 | xargs kill -9 2>/dev/null || true', { shell: '/bin/bash' })
} catch {}

console.log('J.A.R.V.I.S. background service uninstalled.')
