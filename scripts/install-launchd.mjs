#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const PROJECT_ROOT = process.cwd()
const NODE_PATH = process.execPath
const HOME = homedir()
const LAUNCH_AGENTS_DIR = join(HOME, 'Library', 'LaunchAgents')
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, 'com.jarvis.ai.plist')
const JARVIS_LOGS = join(HOME, '.jarvis', 'logs')

mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true })
mkdirSync(JARVIS_LOGS, { recursive: true })

console.log('====================================================')
console.log('  J.A.R.V.I.S. macOS Background Service Installer  ')
console.log('====================================================')
console.log(`Node Binary: ${NODE_PATH}`)
console.log(`Project Root: ${PROJECT_ROOT}`)
console.log(`Plist Destination: ${PLIST_PATH}`)
console.log('----------------------------------------------------')

// 1. Ensure production build exists
console.log('1. Verifying production build...')
if (!existsSync(join(PROJECT_ROOT, 'dist', 'index.html'))) {
  console.log('Building J.A.R.V.I.S. production bundle (npm run build)...')
  execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' })
} else {
  console.log('Production bundle already present.')
}

// 2. Kill any stale processes on 5173 or 8787 before launch
console.log('2. Clearing existing port bindings...')
try {
  execSync('lsof -ti :5173 -ti :8787 | xargs kill -9 2>/dev/null || true', { shell: '/bin/bash' })
} catch {}

// 3. Write LaunchAgent plist
console.log('3. Writing launchd agent configuration...')
const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.jarvis.ai</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${join(PROJECT_ROOT, 'scripts/start.mjs')}</string>
        <string>--prod</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_ROOT}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>JARVIS_ALLOW_WRITES</key>
        <string>1</string>
        <key>JARVIS_MODEL</key>
        <string>gemini-2.5-flash</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${join(JARVIS_LOGS, 'service.log')}</string>
    <key>StandardErrorPath</key>
    <string>${join(JARVIS_LOGS, 'service.err.log')}</string>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
`

writeFileSync(PLIST_PATH, plistContent.trim() + '\n', 'utf8')
console.log(`Wrote LaunchAgent: ${PLIST_PATH}`)

// 4. Register with launchctl
console.log('4. Registering service with macOS launchctl...')
try {
  execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null || true`, { shell: '/bin/bash' })
} catch {}

execSync(`launchctl load -w "${PLIST_PATH}"`, { shell: '/bin/bash' })
console.log('Loaded into launchctl successfully.')

// 5. Verify service status
console.log('5. Waiting for J.A.R.V.I.S. background service to initialize...')
await new Promise((r) => setTimeout(r, 2500))

try {
  const list = execSync(`launchctl list | grep com.jarvis.ai`, { encoding: 'utf8', shell: '/bin/bash' })
  console.log(`launchctl entry: ${list.trim()}`)
} catch (e) {
  console.warn('Could not query launchctl list.')
}

console.log('----------------------------------------------------')
console.log('J.A.R.V.I.S. is now deployed as a 24/7 background service on your Mac!')
console.log('  Web Interface: http://localhost:5173')
console.log('  Gemini Bridge: ws://localhost:8787')
console.log(`  Live Logs: tail -f "${join(JARVIS_LOGS, 'service.log')}"`)
console.log('====================================================')
