#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const JARVIS_DIR = join(homedir(), '.jarvis')
const LOG_DIR = join(JARVIS_DIR, 'logs')
const PID_FILE = join(JARVIS_DIR, 'jarvis.pid')
const LOG_FILE = join(LOG_DIR, 'jarvis.log')
const PROJECT_ROOT = process.cwd()

mkdirSync(LOG_DIR, { recursive: true })

const command = process.argv[2] || 'status'

function isRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getStoredPid() {
  if (existsSync(PID_FILE)) {
    try {
      const pid = parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10)
      if (!isNaN(pid) && isRunning(pid)) {
        return pid
      }
    } catch {}
  }
  return null
}

async function checkPort(port) {
  return new Promise((resolve) => {
    import('node:net').then(({ createConnection }) => {
      const s = createConnection(port, '127.0.0.1')
      s.once('connect', () => {
        s.destroy()
        resolve(true)
      })
      s.once('error', () => {
        resolve(false)
      })
    })
  })
}

async function getLaunchdPid() {
  try {
    const { execSync } = await import('node:child_process')
    const out = execSync('launchctl list 2>/dev/null | grep com.jarvis.ai || true', { encoding: 'utf8' }).trim()
    if (out) {
      const parts = out.split(/\s+/)
      const pid = parseInt(parts[0], 10)
      if (!isNaN(pid) && pid > 0) return pid
    }
  } catch {}
  return null
}

async function status() {
  const manualPid = getStoredPid()
  const launchdPid = await getLaunchdPid()
  const port5173 = await checkPort(5173)
  const port8787 = await checkPort(8787)
  const activeLogs = launchdPid ? join(LOG_DIR, 'service.log') : LOG_FILE

  console.log('----------------------------------------------------')
  console.log('  J.A.R.V.I.S. Background Service Status')
  console.log('----------------------------------------------------')
  if (launchdPid) {
    console.log(`  macOS LaunchAgent (com.jarvis.ai): ACTIVE (PID: ${launchdPid})`)
  } else if (manualPid) {
    console.log(`  Manual Background Daemon: ACTIVE (PID: ${manualPid})`)
  } else {
    console.log(`  Background Process: STOPPED`)
  }
  console.log(`  Web Interface (port 5173): ${port5173 ? 'ONLINE (http://localhost:5173)' : 'OFFLINE'}`)
  console.log(`  Gemini Bridge (port 8787): ${port8787 ? 'ONLINE (ws://localhost:8787)' : 'OFFLINE'}`)
  console.log(`  Active Log: ${activeLogs}`)
  console.log('----------------------------------------------------')
}

async function start() {
  const existingPid = getStoredPid()
  if (existingPid) {
    console.log(`J.A.R.V.I.S. is already running with PID ${existingPid}.`)
    return
  }

  // Open log file stream descriptor
  const { openSync } = await import('node:fs')
  const out = openSync(LOG_FILE, 'a')
  const err = openSync(LOG_FILE, 'a')

  console.log('Starting J.A.R.V.I.S. in background...')

  const child = spawn(
    process.execPath,
    [join(PROJECT_ROOT, 'scripts/start.mjs'), '--prod'],
    {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ['ignore', out, err],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JARVIS_ALLOW_WRITES: '1',
        JARVIS_MODEL: 'gemini-2.5-flash',
      },
    }
  )

  child.unref()
  writeFileSync(PID_FILE, child.pid.toString(), 'utf8')

  console.log(`Launched background process with PID ${child.pid}.`)
  console.log(`Streaming logs to: ${LOG_FILE}`)

  // Wait a moment and check health
  await new Promise((r) => setTimeout(r, 2000))
  await status()
}

async function stop() {
  const pid = getStoredPid()
  if (!pid) {
    console.log('J.A.R.V.I.S. is not running according to PID file.')
  } else {
    console.log(`Stopping J.A.R.V.I.S. process (PID ${pid})...`)
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {}
    }
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE)
    }
  }

  // Double check and kill any lingering listeners on 5173 and 8787
  const { execSync } = await import('node:child_process')
  try {
    const lingering = execSync('lsof -ti :5173 -ti :8787 2>/dev/null', { encoding: 'utf8' }).trim()
    if (lingering) {
      const pids = lingering.split('\n').filter(Boolean)
      for (const p of pids) {
        try { process.kill(parseInt(p, 10), 'SIGKILL') } catch {}
      }
    }
  } catch {}

  console.log('J.A.R.V.I.S. stopped.')
}

async function restart() {
  await stop()
  await new Promise((r) => setTimeout(r, 1000))
  await start()
}

async function logs() {
  const serviceLog = join(LOG_DIR, 'service.log')
  const target = existsSync(serviceLog) ? serviceLog : LOG_FILE
  if (!existsSync(target)) {
    console.log('No log file found yet.')
    return
  }
  console.log(`Tailing ${target} (Ctrl-C to exit)...`)
  const { spawn } = await import('node:child_process')
  const tail = spawn('tail', ['-f', '-n', '50', target], { stdio: 'inherit' })
  process.on('SIGINT', () => tail.kill())
}

switch (command) {
  case 'start':
    await start()
    break
  case 'stop':
    await stop()
    break
  case 'restart':
    await restart()
    break
  case 'status':
    await status()
    break
  case 'logs':
    await logs()
    break
  default:
    console.log(`Usage: node scripts/daemon.mjs [start|stop|restart|status|logs]`)
    break
}
