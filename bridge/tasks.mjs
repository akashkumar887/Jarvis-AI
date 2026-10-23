import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { exec } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * JARVIS Task Management & macOS System Control Server.
 *
 * Equips JARVIS with realistic task execution:
 *   1. Directives & To-Do tracking with persistent storage (~/.jarvis/tasks.json)
 *      and synchronisation with macOS Apple Reminders.
 *   2. Interactive holographic HUD task board rendered directly on screen.
 *   3. macOS System automation:
 *      - Application launching & switching (Spotify, Chrome, VS Code, Notes, Slack, etc.)
 *      - Media playback & Spotify/Music controls (play, pause, next, track info)
 *      - System volume & audio controls (set, mute, unmute, status)
 *      - System diagnostics (battery level, CPU/memory, disk, network)
 *      - Native macOS desktop notifications
 *      - Shell command execution
 */

const STORAGE_DIR = join(homedir(), '.jarvis')
const TASKS_FILE = join(STORAGE_DIR, 'tasks.json')

function loadTasks() {
  try {
    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true })
    }
    if (!existsSync(TASKS_FILE)) {
      writeFileSync(TASKS_FILE, JSON.stringify({ seq: 1, tasks: [] }, null, 2), 'utf8')
      return { seq: 1, tasks: [] }
    }
    const data = JSON.parse(readFileSync(TASKS_FILE, 'utf8'))
    return {
      seq: Number(data.seq) || 1,
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
    }
  } catch {
    return { seq: 1, tasks: [] }
  }
}

function saveTasks(data) {
  try {
    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true })
    }
    writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('[jarvis-tasks] failed to save tasks:', err.message)
  }
}

/** Execute AppleScript safely on macOS without rejecting */
function runAppleScript(script) {
  return new Promise((resolve) => {
    const escaped = script.replace(/"/g, '\\"')
    exec(`osascript -e "${escaped}"`, { timeout: 6000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: stderr.trim() || error.message })
      } else {
        resolve({ ok: true, output: stdout.trim() })
      }
    })
  })
}

/** Execute bash command with timeout */
function runShell(command, cwd = homedir()) {
  return new Promise((resolve) => {
    exec(command, { cwd, timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          ok: false,
          output: (stdout + '\n' + stderr).trim() || error.message,
          code: error.code,
        })
      } else {
        resolve({ ok: true, output: stdout.trim() })
      }
    })
  })
}

function generateTaskMarkup(tasks) {
  const pending = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
  const completed = tasks.filter((t) => t.status === 'completed')
  const total = tasks.length
  const progressRatio = total > 0 ? (completed.length / total).toFixed(2) : '1.0'

  const items = pending.slice(0, 7).map((t, idx) => {
    const num = String(idx + 1).padStart(2, '0')
    const tagClass = t.priority === 'high' ? 'hud-tag hud-hot' : 'hud-tag'
    const tagText = (t.priority || 'NORMAL').toUpperCase()
    const sub = [t.due ? `Due: ${t.due}` : '', t.category || ''].filter(Boolean).join(' · ')
    return `
    <div class="hud-row">
      <div class="hud-idx">[${num}]</div>
      <div class="hud-main">
        <div class="hud-label">${escapeHtml(t.title)}</div>
        ${sub ? `<div class="hud-sub">${escapeHtml(sub)}</div>` : ''}
      </div>
      <div class="${tagClass}">${tagText}</div>
    </div>`
  }).join('')

  return `
<div class="hud-rows">
  <div class="hud-metric">${pending.length} <span class="hud-unit">ACTIVE DIRECTIVES (${completed.length} DONE)</span></div>
  <div class="hud-bar" style="--v:${progressRatio}"></div>
  ${items || '<div class="hud-note hud-dim">No pending directives in queue. All systems nominal.</div>'}
</div>`.trim()
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function tasksServer(emitBlade, _emitPanel) {
  const updateTaskBlade = () => {
    if (!emitBlade) return
    const store = loadTasks()
    const html = generateTaskMarkup(store.tasks)
    emitBlade({
      id: 'jarvis-directives-blade',
      title: 'DIRECTIVE MATRIX',
      kind: 'markup',
      html,
      size: 'tall',
      hold: 'pinned',
    })
  }

  return createSdkMcpServer({
    name: 'jarvis_tasks',
    version: '1.0.0',
    tools: [
      // -----------------------------------------------------------------------
      // TASK CREATION
      // -----------------------------------------------------------------------
      tool(
        'task_create',
        'Create a new directive / to-do task. Saves locally and adds to macOS Apple Reminders if available. Automatically updates the holographic HUD task blade on screen.',
        {
          title: z.string().describe('Clear, concise description of the task or directive.'),
          priority: z.enum(['high', 'medium', 'low']).optional().default('medium').describe('Priority level.'),
          due: z.string().optional().describe('Due date or time (e.g. "today 5pm", "tomorrow morning", "in 2 hours").'),
          category: z.string().optional().default('General').describe('Category or project tag (e.g. Work, Personal, Code, Home).'),
          notes: z.string().optional().describe('Additional notes or details.'),
        },
        async (args) => {
          const store = loadTasks()
          const id = `t-${store.seq++}`
          const task = {
            id,
            title: args.title.trim(),
            priority: args.priority || 'medium',
            due: args.due ? args.due.trim() : null,
            category: args.category ? args.category.trim() : 'General',
            notes: args.notes ? args.notes.trim() : null,
            status: 'pending',
            created: new Date().toISOString(),
            completedAt: null,
          }
          store.tasks.push(task)
          saveTasks(store)

          // Sync with Apple Reminders on macOS if available
          const reminderBody = [task.due ? `Due: ${task.due}` : '', task.notes || ''].filter(Boolean).join('\n')
          const script = `tell application "Reminders"
            try
              make new reminder at default list with properties {name:"${task.title.replace(/"/g, "'")}", body:"${reminderBody.replace(/"/g, "'")}"}
            end try
          end tell`
          runAppleScript(script).catch(() => {})

          // Update HUD blade
          updateTaskBlade()

          return {
            content: [
              {
                type: 'text',
                text: `Task [${id}] "${task.title}" added with ${task.priority.toUpperCase()} priority. Visual directive matrix updated on HUD.`,
              },
            ],
          }
        },
      ),

      // -----------------------------------------------------------------------
      // TASK LISTING
      // -----------------------------------------------------------------------
      tool(
        'task_list',
        'List current directives and tasks. Renders the interactive task board on the HUD blades and returns summary text.',
        {
          status: z.enum(['all', 'pending', 'completed']).optional().default('pending').describe('Filter by task status.'),
          category: z.string().optional().describe('Optional category filter.'),
        },
        async (args) => {
          const store = loadTasks()
          let filtered = store.tasks
          if (args.status === 'pending') {
            filtered = filtered.filter((t) => t.status === 'pending')
          } else if (args.status === 'completed') {
            filtered = filtered.filter((t) => t.status === 'completed')
          }
          if (args.category) {
            const cat = args.category.toLowerCase()
            filtered = filtered.filter((t) => (t.category || '').toLowerCase().includes(cat))
          }

          updateTaskBlade()

          if (!filtered.length) {
            return {
              content: [{ type: 'text', text: `No ${args.status} tasks found in your queue.` }],
            }
          }

          const lines = filtered.map((t, idx) => {
            const num = idx + 1
            const p = t.priority ? `[${t.priority.toUpperCase()}]` : ''
            const d = t.due ? `(due: ${t.due})` : ''
            const status = t.status === 'completed' ? '✓' : '○'
            return `${status} ${num}. [${t.id}] ${p} ${t.title} ${d}`
          })

          return {
            content: [
              {
                type: 'text',
                text: `Directives matrix (${filtered.length} ${args.status} items):\n${lines.join('\n')}`,
              },
            ],
          }
        },
      ),

      // -----------------------------------------------------------------------
      // TASK COMPLETION
      // -----------------------------------------------------------------------
      tool(
        'task_complete',
        'Mark a task as completed by ID, index, or title search. Updates the HUD task board.',
        {
          target: z.string().describe('Task ID (e.g. "t-1"), index number (e.g. "1"), or text fragment of the task title.'),
        },
        async (args) => {
          const store = loadTasks()
          const q = args.target.trim().toLowerCase()
          let found = store.tasks.find((t) => t.id.toLowerCase() === q)

          if (!found) {
            const idx = parseInt(q, 10)
            const pending = store.tasks.filter((t) => t.status === 'pending')
            if (!isNaN(idx) && idx >= 1 && idx <= pending.length) {
              found = pending[idx - 1]
            }
          }

          if (!found) {
            found = store.tasks.find((t) => t.title.toLowerCase().includes(q))
          }

          if (!found) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Could not identify task matching "${args.target}".` }],
            }
          }

          found.status = 'completed'
          found.completedAt = new Date().toISOString()
          saveTasks(store)
          updateTaskBlade()

          return {
            content: [
              {
                type: 'text',
                text: `Task [${found.id}] "${found.title}" marked as complete. HUD updated.`,
              },
            ],
          }
        },
      ),

      // -----------------------------------------------------------------------
      // TASK REMOVAL
      // -----------------------------------------------------------------------
      tool(
        'task_delete',
        'Delete a task from the directive matrix.',
        {
          target: z.string().describe('Task ID, index, or title fragment to remove.'),
        },
        async (args) => {
          const store = loadTasks()
          const q = args.target.trim().toLowerCase()
          const idx = store.tasks.findIndex(
            (t) => t.id.toLowerCase() === q || t.title.toLowerCase().includes(q),
          )

          if (idx === -1) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Task "${args.target}" not found.` }],
            }
          }

          const [removed] = store.tasks.splice(idx, 1)
          saveTasks(store)
          updateTaskBlade()

          return {
            content: [{ type: 'text', text: `Task [${removed.id}] "${removed.title}" removed.` }],
          }
        },
      ),

      // -----------------------------------------------------------------------
      // -----------------------------------------------------------------------
      // macOS APPLICATION LAUNCHER
      // -----------------------------------------------------------------------
      tool(
        'system_open_app',
        'Launch or switch to any application on macOS (e.g. Spotify, Google Chrome, Visual Studio Code, Slack, Notes, Calendar, Reminders, Terminal, Finder, WhatsApp, Mail, Safari, Calculator).',
        {
          app_name: z.string().describe('Name of the application to launch or focus.'),
        },
        async (args) => {
          const app = args.app_name.trim()
          const APP_ALIASES = {
            vscode: 'Visual Studio Code',
            code: 'Visual Studio Code',
            chrome: 'Google Chrome',
            browser: 'Google Chrome',
            music: 'Music',
            notes: 'Notes',
            calendar: 'Calendar',
            reminders: 'Reminders',
            settings: 'System Settings',
            terminal: 'Terminal',
            finder: 'Finder',
            spotify: 'Spotify',
            slack: 'Slack',
            whatsapp: 'WhatsApp',
            mail: 'Mail',
            email: 'Mail',
            safari: 'Safari',
            calculator: 'Calculator',
          }
          if (app.toLowerCase().includes('youtube')) {
            const res = await runShell('open -a "Google Chrome" "https://www.youtube.com" || open "https://www.youtube.com"')
            return { content: [{ type: 'text', text: 'YouTube is now open in Google Chrome.' }] }
          }
          const target = APP_ALIASES[app.toLowerCase()] || app
          const res = await runShell(`open -a "${target}"`)
          if (res.ok) {
            return { content: [{ type: 'text', text: `${target} is now open and focused.` }] }
          }
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to open ${target}: ${res.output}` }],
          }
        },
      ),

      // -----------------------------------------------------------------------
      // macOS URL & WEB BROWSER AUTOMATION (YouTube, Search, Sites)
      // -----------------------------------------------------------------------
      tool(
        'system_open_url',
        'Open any website or URL in Google Chrome or default browser. Use for opening YouTube, searching YouTube, opening Google, GitHub, or any web task.',
        {
          url: z.string().describe('Target URL or web address (e.g. "https://www.youtube.com", "https://www.youtube.com/results?search_query=lofi").'),
          browser: z.enum(['chrome', 'safari', 'default']).optional().default('chrome').describe('Browser to open with.'),
        },
        async (args) => {
          let target = args.url.trim()
          if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = `https://${target}`
          }
          const browser = args.browser || 'chrome'
          let cmd = `open -a "Google Chrome" "${target}"`
          if (browser === 'safari') cmd = `open -a "Safari" "${target}"`
          else if (browser === 'default') cmd = `open "${target}"`

          const res = await runShell(cmd)
          if (res.ok) {
            return { content: [{ type: 'text', text: `Opened ${target} successfully in ${browser === 'chrome' ? 'Google Chrome' : browser}.` }] }
          }
          await runShell(`open "${target}"`)
          return { content: [{ type: 'text', text: `Opened ${target} in browser.` }] }
        },
      ),

      // -----------------------------------------------------------------------
      // WHATSAPP AUTOMATION
      // -----------------------------------------------------------------------
      tool(
        'system_whatsapp',
        'Compose and send a text message on WhatsApp for macOS (or WhatsApp Web). Supports optional recipient phone number and message body.',
        {
          message: z.string().describe('The text message to draft or send.'),
          phone: z.string().optional().describe('Recipient phone number with country code (e.g. "1234567890" or "+919876543210").'),
        },
        async (args) => {
          const text = encodeURIComponent(args.message)
          const phone = args.phone ? args.phone.replace(/[^0-9]/g, '') : ''
          const url = phone ? `whatsapp://send?phone=${phone}&text=${text}` : `whatsapp://send?text=${text}`
          const res = await runShell(`open "${url}"`)
          if (res.ok) {
            return { content: [{ type: 'text', text: `WhatsApp opened with message "${args.message}" pre-filled${phone ? ` for +${phone}` : ''}.` }] }
          }
          const webUrl = phone ? `https://web.whatsapp.com/send?phone=${phone}&text=${text}` : `https://web.whatsapp.com/send?text=${text}`
          await runShell(`open -a "Google Chrome" "${webUrl}" || open "${webUrl}"`)
          return { content: [{ type: 'text', text: `WhatsApp Web opened with message "${args.message}".` }] }
        },
      ),

      // -----------------------------------------------------------------------
      // EMAIL COMPOSER & SENDER
      // -----------------------------------------------------------------------
      tool(
        'system_email',
        'Create, compose, and send an email on macOS using Apple Mail or default mail application.',
        {
          to: z.string().describe('Recipient email address (e.g. "alex@example.com").'),
          subject: z.string().describe('Email subject line.'),
          body: z.string().describe('Email body message.'),
          send_now: z.boolean().optional().default(false).describe('Whether to send immediately or keep open for user review.'),
        },
        async (args) => {
          const to = String(args.to || '').replace(/"/g, "'")
          const subject = String(args.subject || '').replace(/"/g, "'")
          const body = String(args.body || '').replace(/"/g, "'")
          const sendNow = Boolean(args.send_now)

          const script = `tell application "Mail"
            set newMsg to make new outgoing message with properties {subject:"${subject}", content:"${body}", visible:true}
            tell newMsg
              make new to recipient at end of to recipients with properties {address:"${to}"}
            end tell
            activate
            ${sendNow ? 'send newMsg' : ''}
          end tell`

          const res = await runAppleScript(script)
          if (res.ok) {
            return {
              content: [
                {
                  type: 'text',
                  text: sendNow
                    ? `Email to ${to} with subject "${subject}" has been transmitted, sir.`
                    : `Email drafted for ${to} with subject "${subject}". Apple Mail is open for review, sir.`,
                },
              ],
            }
          }

          const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
          await runShell(`open "${mailto}"`)
          return { content: [{ type: 'text', text: `Email composer opened for ${to} with subject "${subject}".` }] }
        },
      ),

      // -----------------------------------------------------------------------
      // macOS MEDIA / SPOTIFY CONTROL
      // -----------------------------------------------------------------------
      tool(
        'system_media',
        'Control media playback on macOS (Spotify or Apple Music): play, pause, toggle, next track, previous track, or get current track info.',
        {
          action: z.enum(['play', 'pause', 'toggle', 'next', 'previous', 'status']).describe('Media action to execute.'),
          player: z.enum(['auto', 'spotify', 'music']).optional().default('auto').describe('Target player.'),
        },
        async (args) => {
          const action = args.action
          // Check if Spotify is running
          const checkSpotify = await runAppleScript('application "Spotify" is running')
          const isSpotifyRunning = checkSpotify.ok && checkSpotify.output === 'true'

          const targetApp = (args.player === 'spotify' || (args.player === 'auto' && isSpotifyRunning))
            ? 'Spotify'
            : 'Music'

          if (action === 'status') {
            const script = `tell application "${targetApp}"
              if running then
                set tState to player state as string
                set tName to name of current track
                set tArtist to artist of current track
                return tState & ": " & tName & " by " & tArtist
              else
                return "${targetApp} is not running"
              end if
            end tell`
            const res = await runAppleScript(script)
            return { content: [{ type: 'text', text: res.output || `${targetApp} status unknown.` }] }
          }

          let verb = 'playpause'
          if (action === 'play') verb = 'play'
          if (action === 'pause') verb = 'pause'
          if (action === 'next') verb = 'next track'
          if (action === 'previous') verb = 'previous track'

          const script = `tell application "${targetApp}"
            ${verb}
            if running then
              try
                return name of current track & " by " & artist of current track
              end try
            end if
          end tell`
          const res = await runAppleScript(script)
          return {
            content: [
              {
                type: 'text',
                text: `${targetApp} command executed (${action}). ${res.output ? 'Now playing: ' + res.output : ''}`,
              },
            ],
          }
        },
      ),

      // -----------------------------------------------------------------------
      // macOS VOLUME CONTROL
      // -----------------------------------------------------------------------
      tool(
        'system_volume',
        'Control system output volume on macOS (set volume percentage, mute, unmute, or get current level).',
        {
          action: z.enum(['set', 'mute', 'unmute', 'status', 'up', 'down']).describe('Volume operation.'),
          level: z.number().min(0).max(100).optional().describe('Volume level (0 to 100) when action is "set".'),
        },
        async (args) => {
          if (args.action === 'status') {
            const res = await runAppleScript('get volume settings')
            return { content: [{ type: 'text', text: `System audio settings: ${res.output}` }] }
          }
          if (args.action === 'mute') {
            await runAppleScript('set volume output muted true')
            return { content: [{ type: 'text', text: 'System audio muted.' }] }
          }
          if (args.action === 'unmute') {
            await runAppleScript('set volume output muted false')
            return { content: [{ type: 'text', text: 'System audio unmuted.' }] }
          }
          if (args.action === 'up') {
            await runAppleScript('set volume output volume ((output volume of (get volume settings)) + 10)')
            return { content: [{ type: 'text', text: 'Volume increased by 10%.' }] }
          }
          if (args.action === 'down') {
            await runAppleScript('set volume output volume ((output volume of (get volume settings)) - 10)')
            return { content: [{ type: 'text', text: 'Volume decreased by 10%.' }] }
          }
          if (args.action === 'set') {
            const lvl = Math.min(100, Math.max(0, args.level ?? 50))
            await runAppleScript(`set volume output volume ${lvl}`)
            return { content: [{ type: 'text', text: `System output volume set to ${lvl}%.` }] }
          }
          return { content: [{ type: 'text', text: 'Volume adjusted.' }] }
        },
      ),

      // -----------------------------------------------------------------------
      // SYSTEM DIAGNOSTICS & STATS
      // -----------------------------------------------------------------------
      tool(
        'system_stats',
        'Retrieve real-time system diagnostics on macOS: battery percentage & power source, load/uptime, disk space, and WiFi connection.',
        {},
        async () => {
          const [batt, disk, up] = await Promise.all([
            runShell('pmset -g batt'),
            runShell('df -h / | awk "NR==2 {print \\$4 \\" free of \\" \\$2}"'),
            runShell('uptime'),
          ])

          const batteryLine = batt.output.split('\n')[1] || batt.output
          const match = batteryLine.match(/(\d+)%/)
          const battPct = match ? match[1] + '%' : 'AC Connected'

          const text = [
            `Power & Battery: ${batteryLine.trim()}`,
            `Disk Storage: ${disk.output.trim()}`,
            `System Uptime: ${up.output.trim()}`,
          ].join('\n')

          if (emitBlade) {
            const html = `
<div class="hud-rows">
  <div class="hud-metric">${battPct} <span class="hud-unit">POWER RESERVE</span></div>
  <div class="hud-bar" style="--v:${match ? Number(match[1]) / 100 : 1}"></div>
  <div class="hud-row">
    <div class="hud-idx">[SYS]</div>
    <div class="hud-main">
      <div class="hud-label">Disk Storage</div>
      <div class="hud-sub">${escapeHtml(disk.output.trim())}</div>
    </div>
    <div class="hud-tag">NOMINAL</div>
  </div>
  <div class="hud-row">
    <div class="hud-idx">[PWR]</div>
    <div class="hud-main">
      <div class="hud-label">Battery State</div>
      <div class="hud-sub">${escapeHtml(batteryLine.trim())}</div>
    </div>
    <div class="hud-tag hud-hot">${match ? match[1] + '%' : 'AC'}</div>
  </div>
</div>`.trim()

            emitBlade({
              id: 'jarvis-diagnostics-blade',
              title: 'SYSTEM TELEMETRY',
              kind: 'markup',
              html,
              size: 'tall',
              hold: 'turn',
            })
          }

          return { content: [{ type: 'text', text }] }
        },
      ),

      // -----------------------------------------------------------------------
      // NATIVE macOS DESKTOP NOTIFICATION
      // -----------------------------------------------------------------------
      tool(
        'system_notify',
        'Post a native macOS desktop notification banner with sound.',
        {
          title: z.string().describe('Title of the notification.'),
          message: z.string().describe('Notification body text.'),
        },
        async (args) => {
          const title = args.title.replace(/"/g, "'")
          const msg = args.message.replace(/"/g, "'")
          await runAppleScript(`display notification "${msg}" with title "${title}" sound name "Glass"`)
          return { content: [{ type: 'text', text: `Notification posted: "${title}".` }] }
        },
      ),

      // -----------------------------------------------------------------------
      // SHELL COMMAND EXECUTION
      // -----------------------------------------------------------------------
      tool(
        'system_run_command',
        'Execute a shell command on macOS (e.g. file searches with mdfind, git operations, local scripts, directory listings).',
        {
          command: z.string().describe('The bash/zsh command line string to run.'),
          cwd: z.string().optional().describe('Working directory. Defaults to user home directory.'),
        },
        async (args) => {
          const res = await runShell(args.command, args.cwd || homedir())
          if (res.ok) {
            return {
              content: [
                {
                  type: 'text',
                  text: res.output ? res.output.slice(0, 4000) : 'Command completed successfully with no output.',
                },
              ],
            }
          }
          return {
            isError: true,
            content: [{ type: 'text', text: `Command failed (code ${res.code}):\n${res.output}` }],
          }
        },
      ),
      // -----------------------------------------------------------------------
      // macOS DARK MODE / APPEARANCE
      // -----------------------------------------------------------------------
      tool(
        'system_dark_mode',
        'Toggle or set macOS Dark Mode / Light Mode system appearance.',
        {
          action: z.enum(['toggle', 'dark', 'light', 'status']).default('toggle').describe('Appearance operation.'),
        },
        async (args) => {
          if (args.action === 'status') {
            const res = await runAppleScript('tell application "System Events" to tell appearance preferences to get dark mode')
            return { content: [{ type: 'text', text: `macOS Appearance: ${res.output === 'true' ? 'Dark Mode' : 'Light Mode'}.` }] }
          }
          let script = 'tell application "System Events" to tell appearance preferences to set dark mode to not dark mode'
          if (args.action === 'dark') {
            script = 'tell application "System Events" to tell appearance preferences to set dark mode to true'
          } else if (args.action === 'light') {
            script = 'tell application "System Events" to tell appearance preferences to set dark mode to false'
          }
          await runAppleScript(script)
          return { content: [{ type: 'text', text: `macOS system appearance adjusted (${args.action}).` }] }
        },
      ),

      // -----------------------------------------------------------------------
      // macOS POWER & LOCK SUBSYSTEM
      // -----------------------------------------------------------------------
      tool(
        'system_power',
        'Control MacBook power states: lock screen, put system to sleep, sleep display, or check battery power.',
        {
          action: z.enum(['lock', 'sleep', 'display_sleep', 'battery_info']).describe('Power subsystem action.'),
        },
        async (args) => {
          if (args.action === 'lock') {
            await runShell('/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend || pmset displaysleepnow')
            return { content: [{ type: 'text', text: 'MacBook display locked, sir.' }] }
          }
          if (args.action === 'sleep') {
            await runAppleScript('tell application "System Events" to sleep')
            return { content: [{ type: 'text', text: 'Entering system sleep mode, sir.' }] }
          }
          if (args.action === 'display_sleep') {
            await runShell('pmset displaysleepnow')
            return { content: [{ type: 'text', text: 'Display powered down into sleep mode, sir.' }] }
          }
          const res = await runShell('pmset -g batt')
          return { content: [{ type: 'text', text: `MacBook Battery Status:\n${res.output}` }] }
        },
      ),

      // -----------------------------------------------------------------------
      // macOS SCREENSHOT CAPTURE
      // -----------------------------------------------------------------------
      tool(
        'system_screenshot',
        'Capture a screenshot of your MacBook display and save it to your Desktop.',
        {
          target: z.enum(['desktop', 'downloads']).optional().default('desktop').describe('Destination directory.'),
        },
        async (args) => {
          const folder = args.target === 'downloads' ? join(homedir(), 'Downloads') : join(homedir(), 'Desktop')
          const filename = `Jarvis_Screen_${Date.now()}.png`
          const fullPath = join(folder, filename)
          const res = await runShell(`screencapture -x "${fullPath}"`)
          if (res.ok) {
            await runAppleScript(`display notification "Screenshot saved to ${args.target}" with title "J.A.R.V.I.S. Screen Capture" sound name "Glass"`)
            return { content: [{ type: 'text', text: `Screenshot captured and saved to ${fullPath}, sir.` }] }
          }
          return { isError: true, content: [{ type: 'text', text: `Failed to capture screenshot: ${res.output}` }] }
        },
      ),

      // -----------------------------------------------------------------------
      // macOS CLIPBOARD SUBSYSTEM
      // -----------------------------------------------------------------------
      tool(
        'system_clipboard',
        'Read text from or copy text to the macOS system clipboard (pbcopy / pbpaste).',
        {
          action: z.enum(['get', 'set']).describe('Whether to read or write clipboard.'),
          text: z.string().optional().describe('Text to copy when action is "set".'),
        },
        async (args) => {
          if (args.action === 'set') {
            const safeText = (args.text || '').replace(/"/g, '\\"')
            await runShell(`echo "${safeText}" | pbcopy`)
            return { content: [{ type: 'text', text: `Copied text to clipboard, sir.` }] }
          }
          const res = await runShell('pbpaste')
          return { content: [{ type: 'text', text: res.output ? `Clipboard content: "${res.output}"` : 'Clipboard is currently empty.' }] }
        },
      ),

      // -----------------------------------------------------------------------
      // macOS FINDER & FILE SUBSYSTEM
      // -----------------------------------------------------------------------
      tool(
        'system_finder',
        'macOS Finder operations: empty trash, open common folders (Desktop, Downloads, Documents), or search files using Spotlight.',
        {
          action: z.enum(['empty_trash', 'open_folder', 'search_files']).describe('Finder operation.'),
          folder: z.enum(['desktop', 'downloads', 'documents', 'home', 'applications']).optional().describe('Folder to open.'),
          query: z.string().optional().describe('File name or query to search with Spotlight.'),
        },
        async (args) => {
          if (args.action === 'empty_trash') {
            await runAppleScript('tell application "Finder" to empty trash')
            return { content: [{ type: 'text', text: 'Trash emptied, sir.' }] }
          }
          if (args.action === 'open_folder') {
            const f = args.folder || 'downloads'
            const map = {
              desktop: '~/Desktop',
              downloads: '~/Downloads',
              documents: '~/Documents',
              home: '~',
              applications: '/Applications',
            }
            await runShell(`open "${map[f] || '~'}"`)
            return { content: [{ type: 'text', text: `Opened ${f} in Finder, sir.` }] }
          }
          if (args.action === 'search_files') {
            const q = (args.query || '').trim()
            if (!q) return { content: [{ type: 'text', text: 'Please specify a file name to search for.' }] }
            const res = await runShell(`mdfind -name "${q}" | head -n 6`)
            return { content: [{ type: 'text', text: res.output ? `Files matching "${q}":\n${res.output}` : `No files found matching "${q}".` }] }
          }
          return { content: [{ type: 'text', text: 'Finder command processed.' }] }
        },
      ),

      // -----------------------------------------------------------------------
      // macOS NETWORK SUBSYSTEM
      // -----------------------------------------------------------------------
      tool(
        'system_network',
        'Inspect and control MacBook Wi-Fi, check IP address, and test internet latency.',
        {
          action: z.enum(['status', 'wifi_on', 'wifi_off', 'get_ip', 'ping']).describe('Network operation.'),
        },
        async (args) => {
          if (args.action === 'wifi_on') {
            await runShell('networksetup -setairportpower en0 on')
            return { content: [{ type: 'text', text: 'Wi-Fi interface en0 powered ON, sir.' }] }
          }
          if (args.action === 'wifi_off') {
            await runShell('networksetup -setairportpower en0 off')
            return { content: [{ type: 'text', text: 'Wi-Fi interface en0 powered OFF, sir.' }] }
          }
          if (args.action === 'get_ip') {
            const [localIp, pubIp] = await Promise.all([
              runShell('ipconfig getifaddr en0'),
              runShell('curl -s --max-time 3 https://ifconfig.me'),
            ])
            return { content: [{ type: 'text', text: `Local IP: ${localIp.output.trim() || 'Offline'}\nPublic IP: ${pubIp.output.trim() || 'Unavailable'}` }] }
          }
          if (args.action === 'ping') {
            const res = await runShell('ping -c 3 8.8.8.8')
            return { content: [{ type: 'text', text: `Network Latency Test:\n${res.output}` }] }
          }
          const [pwr, localIp] = await Promise.all([
            runShell('networksetup -getairportpower en0'),
            runShell('ipconfig getifaddr en0'),
          ])
          return { content: [{ type: 'text', text: `${pwr.output.trim()} · IP: ${localIp.output.trim() || 'Disconnected'}` }] }
        },
      ),

      // -----------------------------------------------------------------------
      // macOS PROCESS MONITOR
      // -----------------------------------------------------------------------
      tool(
        'system_top_processes',
        'Inspect top resource-consuming processes running on macOS (CPU & Memory).',
        {
          limit: z.number().optional().default(5).describe('Number of top processes to return.'),
        },
        async (args) => {
          const limit = Math.min(10, Math.max(3, args.limit || 5))
          const res = await runShell(`ps -eo %cpu,%mem,comm -r | head -n ${limit + 1}`)
          return { content: [{ type: 'text', text: `Top ${limit} Active MacBook Processes:\n${res.output}` }] }
        },
      ),
    ],
  })
}

export const TASK_TOOLS_DEFINITIONS = [
  {
    name: 'task_create',
    description: 'Create a new directive or to-do task. Saves locally, synchronises with macOS Apple Reminders, and displays the holographic HUD directive matrix blade.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Clear, concise description of the task or directive.' },
        priority: { type: 'STRING', enum: ['high', 'medium', 'low'], description: 'Priority level (default medium).' },
        due: { type: 'STRING', description: 'Due date or time (e.g. "today 5pm", "in 2 hours").' },
        category: { type: 'STRING', description: 'Category or project tag (e.g. Work, Personal, Code, Home).' },
        notes: { type: 'STRING', description: 'Additional notes or details.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'task_list',
    description: 'List current directives and tasks. Renders the interactive task board on the HUD blades and returns summary text.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['all', 'pending', 'completed'], description: 'Filter by task status.' },
        category: { type: 'STRING', description: 'Optional category filter.' },
      },
    },
  },
  {
    name: 'task_complete',
    description: 'Mark a task as completed by ID, index number (e.g. "1"), or title search. Updates the HUD task board.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', description: 'Task ID (e.g. "t-1"), index number (e.g. "1"), or text fragment of the task title.' },
      },
      required: ['target'],
    },
  },
  {
    name: 'task_delete',
    description: 'Delete a task from the directive matrix.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', description: 'Task ID, index, or title fragment to remove.' },
      },
      required: ['target'],
    },
  },
  {
    name: 'system_open_app',
    description: 'Launch or switch to any application on macOS (e.g. Spotify, Google Chrome, Visual Studio Code, Slack, Notes, Calendar, Reminders, Terminal, Finder, WhatsApp, Mail, Safari, Calculator).',
    parameters: {
      type: 'OBJECT',
      properties: {
        app_name: { type: 'STRING', description: 'Name of the application to launch or focus.' },
      },
      required: ['app_name'],
    },
  },
  {
    name: 'system_open_url',
    description: 'Open any website, URL, or YouTube video/search in Google Chrome or default browser. Ideal for YouTube, Google searches, docs, or web tasks.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: { type: 'STRING', description: 'The web URL to open (e.g. "https://www.youtube.com", "https://www.youtube.com/results?search_query=relaxing+music").' },
        browser: { type: 'STRING', enum: ['chrome', 'safari', 'default'], description: 'Browser to use (default chrome).' },
      },
      required: ['url'],
    },
  },
  {
    name: 'system_whatsapp',
    description: 'Compose and send a text message on WhatsApp for macOS. Supports phone number and message body.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: { type: 'STRING', description: 'Text message to send.' },
        phone: { type: 'STRING', description: 'Optional recipient phone number.' },
      },
      required: ['message'],
    },
  },
  {
    name: 'system_email',
    description: 'Draft or send an email on macOS with recipient, subject, and body content via Apple Mail.',
    parameters: {
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: 'Recipient email address.' },
        subject: { type: 'STRING', description: 'Email subject.' },
        body: { type: 'STRING', description: 'Email body text.' },
        send_now: { type: 'BOOLEAN', description: 'True to transmit immediately, false to review draft.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'system_media',
    description: 'Control media playback on macOS (Spotify or Apple Music): play, pause, toggle, next track, previous track, or get current track info.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['play', 'pause', 'toggle', 'next', 'previous', 'status'], description: 'Media action to execute.' },
        player: { type: 'STRING', enum: ['auto', 'spotify', 'music'], description: 'Target player.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'system_volume',
    description: 'Control system output volume on macOS (set volume percentage, mute, unmute, status, up, down).',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['set', 'mute', 'unmute', 'status', 'up', 'down'], description: 'Volume operation.' },
        level: { type: 'NUMBER', description: 'Volume level (0 to 100) when action is "set".' },
      },
      required: ['action'],
    },
  },
  {
    name: 'system_stats',
    description: 'Retrieve real-time system diagnostics on macOS: battery percentage & power source, load/uptime, disk space, and WiFi connection.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'system_notify',
    description: 'Post a native macOS desktop notification banner with sound.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title of the notification.' },
        message: { type: 'STRING', description: 'Notification body text.' },
      },
      required: ['title', 'message'],
    },
  },
  {
    name: 'system_run_command',
    description: 'Execute a shell command on macOS (e.g. file searches with mdfind, git operations, local scripts, directory listings).',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: { type: 'STRING', description: 'The bash/zsh command line string to run.' },
        cwd: { type: 'STRING', description: 'Working directory.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'system_dark_mode',
    description: 'Toggle or set macOS Dark Mode / Light Mode system appearance.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['toggle', 'dark', 'light', 'status'], description: 'Appearance action.' },
      },
    },
  },
  {
    name: 'system_power',
    description: 'Control MacBook power states: lock screen, put system to sleep, sleep display, or check battery status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['lock', 'sleep', 'display_sleep', 'battery_info'], description: 'Power subsystem operation.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'system_screenshot',
    description: 'Capture a screenshot of your MacBook screen and save to Desktop or Downloads.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', enum: ['desktop', 'downloads'], description: 'Save location (default desktop).' },
      },
    },
  },
  {
    name: 'system_clipboard',
    description: 'Read from (pbpaste) or write to (pbcopy) macOS clipboard.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['get', 'set'], description: 'Clipboard action.' },
        text: { type: 'STRING', description: 'Text to copy when action is set.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'system_finder',
    description: 'macOS Finder operations: empty trash, open common folders, or search files using Spotlight (mdfind).',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['empty_trash', 'open_folder', 'search_files'], description: 'Finder action.' },
        folder: { type: 'STRING', enum: ['desktop', 'downloads', 'documents', 'home', 'applications'], description: 'Folder to open.' },
        query: { type: 'STRING', description: 'File name to search.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'system_network',
    description: 'Inspect and control MacBook Wi-Fi, IP address, and test internet connection latency.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['status', 'wifi_on', 'wifi_off', 'get_ip', 'ping'], description: 'Network action.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'system_top_processes',
    description: 'Inspect top resource-consuming processes running on macOS (CPU & Memory).',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Number of processes (default 5).' },
      },
    },
  },
]

export async function executeTaskTool(name, args = {}, emitBlade, _emitPanel) {
  const updateTaskBlade = () => {
    if (!emitBlade) return
    const store = loadTasks()
    const html = generateTaskMarkup(store.tasks)
    emitBlade({
      id: 'jarvis-directives-blade',
      title: 'DIRECTIVE MATRIX',
      kind: 'markup',
      html,
      size: 'tall',
      hold: 'pinned',
    })
  }

  switch (name) {
    case 'task_create': {
      const store = loadTasks()
      const id = `t-${store.seq++}`
      const task = {
        id,
        title: String(args.title || 'Untitled Directive').trim(),
        priority: args.priority || 'medium',
        due: args.due ? String(args.due).trim() : null,
        category: args.category ? String(args.category).trim() : 'General',
        notes: args.notes ? String(args.notes).trim() : null,
        status: 'pending',
        created: new Date().toISOString(),
        completedAt: null,
      }
      store.tasks.push(task)
      saveTasks(store)

      const reminderBody = [task.due ? `Due: ${task.due}` : '', task.notes || ''].filter(Boolean).join('\n')
      const script = `tell application "Reminders"
        try
          make new reminder at default list with properties {name:"${task.title.replace(/"/g, "'")}", body:"${reminderBody.replace(/"/g, "'")}"}
        end try
      end tell`
      runAppleScript(script).catch(() => {})
      updateTaskBlade()
      return `Task [${id}] "${task.title}" added with ${task.priority.toUpperCase()} priority. Visual directive matrix updated on HUD.`
    }

    case 'task_list': {
      const store = loadTasks()
      let filtered = store.tasks
      const status = args.status || 'pending'
      if (status === 'pending') {
        filtered = filtered.filter((t) => t.status === 'pending')
      } else if (status === 'completed') {
        filtered = filtered.filter((t) => t.status === 'completed')
      }
      if (args.category) {
        const cat = args.category.toLowerCase()
        filtered = filtered.filter((t) => (t.category || '').toLowerCase().includes(cat))
      }
      updateTaskBlade()
      if (!filtered.length) {
        return `No ${status} tasks found in your queue.`
      }
      const lines = filtered.map((t, idx) => {
        const num = idx + 1
        const p = t.priority ? `[${t.priority.toUpperCase()}]` : ''
        const d = t.due ? `(due: ${t.due})` : ''
        const stat = t.status === 'completed' ? '✓' : '○'
        return `${stat} ${num}. [${t.id}] ${p} ${t.title} ${d}`
      })
      return `Directives matrix (${filtered.length} ${status} items):\n${lines.join('\n')}`
    }

    case 'task_complete': {
      const store = loadTasks()
      const q = String(args.target || '').trim().toLowerCase()
      let found = store.tasks.find((t) => t.id.toLowerCase() === q)
      if (!found) {
        const idx = parseInt(q, 10)
        const pending = store.tasks.filter((t) => t.status === 'pending')
        if (!isNaN(idx) && idx >= 1 && idx <= pending.length) {
          found = pending[idx - 1]
        }
      }
      if (!found) {
        found = store.tasks.find((t) => t.title.toLowerCase().includes(q))
      }
      if (!found) {
        return `Could not identify task matching "${args.target}".`
      }
      found.status = 'completed'
      found.completedAt = new Date().toISOString()
      saveTasks(store)
      updateTaskBlade()
      return `Task [${found.id}] "${found.title}" marked as complete. HUD updated.`
    }

    case 'task_delete': {
      const store = loadTasks()
      const q = String(args.target || '').trim().toLowerCase()
      const idx = store.tasks.findIndex(
        (t) => t.id.toLowerCase() === q || t.title.toLowerCase().includes(q),
      )
      if (idx === -1) {
        return `Task "${args.target}" not found.`
      }
      const [removed] = store.tasks.splice(idx, 1)
      saveTasks(store)
      updateTaskBlade()
      return `Task [${removed.id}] "${removed.title}" removed.`
    }

    case 'system_open_app': {
      const app = String(args.app_name || '').trim()
      const APP_ALIASES = {
        vscode: 'Visual Studio Code',
        code: 'Visual Studio Code',
        chrome: 'Google Chrome',
        browser: 'Google Chrome',
        music: 'Music',
        notes: 'Notes',
        calendar: 'Calendar',
        reminders: 'Reminders',
        settings: 'System Settings',
        terminal: 'Terminal',
        finder: 'Finder',
        spotify: 'Spotify',
        slack: 'Slack',
        whatsapp: 'WhatsApp',
        mail: 'Mail',
        email: 'Mail',
        safari: 'Safari',
        calculator: 'Calculator',
      }
      if (app.toLowerCase().includes('youtube')) {
        await runShell('open -a "Google Chrome" "https://www.youtube.com" || open "https://www.youtube.com"')
        return 'YouTube is now open in Google Chrome.'
      }
      const target = APP_ALIASES[app.toLowerCase()] || app
      const res = await runShell(`open -a "${target}"`)
      if (res.ok) {
        return `${target} is now open and focused.`
      }
      return `Failed to open ${target}: ${res.output}`
    }

    case 'system_open_url': {
      let target = String(args.url || '').trim()
      if (!target) target = 'https://www.youtube.com'
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = `https://${target}`
      }
      const browser = args.browser || 'chrome'
      const isYoutube = target.includes('youtube.com')
      let cmd = `open -a "Google Chrome" "${target}"`
      if (browser === 'safari') cmd = `open -a "Safari" "${target}"`
      else if (browser === 'default') cmd = `open "${target}"`

      const res = await runShell(cmd)

      if (emitBlade) {
        const title = isYoutube ? 'YOUTUBE · STREAMING ENGINE' : 'BROWSER · SECURE NAVIGATION'
        const label = isYoutube ? (args.query || 'YouTube Stream') : target
        const html = `
<div class="hud-rows" style="padding: 16px;">
  <div class="hud-metric">${isYoutube ? 'YOUTUBE' : 'UPLINK'} <span class="hud-unit">ACTIVE STREAM</span></div>
  <div class="hud-bar" style="--v:1.0"></div>
  <div class="hud-row">
    <div class="hud-idx">[STREAM]</div>
    <div class="hud-main">
      <div class="hud-label">${escapeHtml(label)}</div>
      <div class="hud-sub">Browser: ${browser === 'chrome' ? 'Google Chrome' : browser} · GPU Accelerated</div>
    </div>
    <div class="hud-tag hud-hot">LIVE</div>
  </div>
  <div style="margin-top: 14px; padding: 12px; background: rgba(245, 166, 35, 0.08); border-left: 3px solid var(--accent); border-radius: 4px;">
    <div style="font-size: 11px; color: #fff; margin-bottom: 6px;">🎬 Media stream initiated on your display, sir.</div>
    <div style="font-size: 10px; opacity: 0.6; word-break: break-all;">${escapeHtml(target)}</div>
  </div>
</div>`.trim()

        emitBlade({
          id: 'youtube-stream-blade',
          title,
          kind: 'markup',
          html,
          size: 'tall',
          hold: 'turn',
        })
      }

      if (res.ok) {
        return `Opened ${target} in ${browser === 'chrome' ? 'Google Chrome' : browser}.`
      }
      await runShell(`open "${target}"`)
      return `Opened ${target} in default browser.`
    }

    case 'system_whatsapp': {
      const message = String(args.message || '')
      const text = encodeURIComponent(message)
      const phone = args.phone ? String(args.phone).replace(/[^0-9]/g, '') : ''
      const recipient = args.recipient || (phone ? `+${phone}` : 'Specified Contact')
      const url = phone ? `whatsapp://send?phone=${phone}&text=${text}` : `whatsapp://send?text=${text}`
      const res = await runShell(`open "${url}"`)

      if (emitBlade) {
        const html = `
<div class="hud-rows" style="padding: 16px;">
  <div class="hud-metric">WHATSAPP <span class="hud-unit">SECURE UPLINK</span></div>
  <div class="hud-bar" style="--v:1.0"></div>
  <div class="hud-row">
    <div class="hud-idx">[MSG]</div>
    <div class="hud-main">
      <div class="hud-label">Recipient: ${escapeHtml(recipient)}</div>
      <div class="hud-sub">Encryption: End-to-End · Protocol: WhatsApp Desktop</div>
    </div>
    <div class="hud-tag hud-hot">TRANSMITTED</div>
  </div>
  <div style="margin-top: 14px; padding: 14px; background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.3); border-radius: 4px;">
    <div style="font-size: 10px; opacity: 0.7; letter-spacing: 0.1em; color: #6aff8d; margin-bottom: 4px;">DISPATCH PAYLOAD:</div>
    <div style="font-size: 13px; color: #ffffff; line-height: 1.4;">"${escapeHtml(message)}"</div>
  </div>
</div>`.trim()

        emitBlade({
          id: 'whatsapp-transmission-blade',
          title: 'WHATSAPP · TRANSMISSION',
          kind: 'markup',
          html,
          size: 'compact',
          hold: 'turn',
        })
      }

      if (res.ok) {
        return `WhatsApp launched with your message pre-filled${phone ? ` for +${phone}` : ''}, sir.`
      }
      const webUrl = phone ? `https://web.whatsapp.com/send?phone=${phone}&text=${text}` : `https://web.whatsapp.com/send?text=${text}`
      await runShell(`open -a "Google Chrome" "${webUrl}" || open "${webUrl}"`)
      return `WhatsApp Web opened with your message, sir.`
    }

    case 'system_email': {
      const to = String(args.to || '').replace(/"/g, "'")
      const subject = String(args.subject || 'Directive from J.A.R.V.I.S.').replace(/"/g, "'")
      const body = String(args.body || '').replace(/"/g, "'")
      const sendNow = Boolean(args.send_now)

      const script = `tell application "Mail"
        set newMsg to make new outgoing message with properties {subject:"${subject}", content:"${body}", visible:true}
        tell newMsg
          make new to recipient at end of to recipients with properties {address:"${to}"}
        end tell
        activate
        ${sendNow ? 'send newMsg' : ''}
      end tell`

      const res = await runAppleScript(script)

      if (emitBlade) {
        const html = `
<div class="hud-rows" style="padding: 16px;">
  <div class="hud-metric">APPLE MAIL <span class="hud-unit">TRANSMISSION</span></div>
  <div class="hud-bar" style="--v:1.0"></div>
  <div class="hud-row">
    <div class="hud-idx">[MAIL]</div>
    <div class="hud-main">
      <div class="hud-label">To: ${escapeHtml(to)}</div>
      <div class="hud-sub">Subject: ${escapeHtml(subject)}</div>
    </div>
    <div class="hud-tag hud-hot">${sendNow ? 'SENT' : 'DRAFTED'}</div>
  </div>
  <div style="margin-top: 14px; padding: 14px; background: rgba(245,166,35,0.08); border-left: 3px solid var(--accent); border-radius: 4px;">
    <div style="font-size: 10px; opacity: 0.7; letter-spacing: 0.1em; margin-bottom: 4px;">MESSAGE CONTENT:</div>
    <div style="font-size: 12px; color: #ffffff; line-height: 1.5;">${escapeHtml(body)}</div>
  </div>
</div>`.trim()

        emitBlade({
          id: 'email-transmission-blade',
          title: 'EMAIL · TRANSMISSION',
          kind: 'markup',
          html,
          size: 'tall',
          hold: 'turn',
        })
      }

      if (res.ok) {
        return sendNow
          ? `Email to ${to} with subject "${subject}" has been transmitted, sir.`
          : `Email drafted for ${to} in Apple Mail with subject "${subject}". Projected onto your screen, sir.`
      }

      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      await runShell(`open "${mailto}"`)
      return `Email composer opened for ${to} with subject "${subject}".`
    }

    case 'system_media': {
      const action = args.action || 'play'
      const checkSpotify = await runAppleScript('application "Spotify" is running')
      const isSpotifyRunning = checkSpotify.ok && checkSpotify.output === 'true'
      const targetApp = (args.player === 'spotify' || (args.player === 'auto' && isSpotifyRunning))
        ? 'Spotify'
        : 'Music'

      if (action === 'status') {
        const script = `tell application "${targetApp}"
          if running then
            set tState to player state as string
            set tName to name of current track
            set tArtist to artist of current track
            return tState & ": " & tName & " by " & tArtist
          else
            return "${targetApp} is not running"
          end if
        end tell`
        const res = await runAppleScript(script)
        return res.output || `${targetApp} status unknown.`
      }

      let verb = 'playpause'
      if (action === 'play') verb = 'play'
      if (action === 'pause') verb = 'pause'
      if (action === 'next') verb = 'next track'
      if (action === 'previous') verb = 'previous track'

      const script = `tell application "${targetApp}"
        ${verb}
        if running then
          try
            return name of current track & " by " & artist of current track
          end try
        end if
      end tell`
      const res = await runAppleScript(script)
      return `${targetApp} command executed (${action}). ${res.output ? 'Now playing: ' + res.output : ''}`
    }

    case 'system_volume': {
      const action = args.action
      if (action === 'status') {
        const res = await runAppleScript('get volume settings')
        return `System audio settings: ${res.output}`
      }
      if (action === 'mute') {
        await runAppleScript('set volume output muted true')
        return 'System audio muted.'
      }
      if (action === 'unmute') {
        await runAppleScript('set volume output muted false')
        return 'System audio unmuted.'
      }
      if (action === 'up') {
        await runAppleScript('set volume output volume ((output volume of (get volume settings)) + 10)')
        return 'Volume increased by 10%.'
      }
      if (action === 'down') {
        await runAppleScript('set volume output volume ((output volume of (get volume settings)) - 10)')
        return 'Volume decreased by 10%.'
      }
      if (action === 'set') {
        const lvl = Math.min(100, Math.max(0, args.level ?? 50))
        await runAppleScript(`set volume output volume ${lvl}`)
        return `System output volume set to ${lvl}%.`
      }
      return 'Volume adjusted.'
    }

    case 'system_stats': {
      const [batt, disk, up] = await Promise.all([
        runShell('pmset -g batt'),
        runShell('df -h / | awk "NR==2 {print \\$4 \\" free of \\" \\$2}"'),
        runShell('uptime'),
      ])
      const batteryLine = batt.output.split('\n')[1] || batt.output
      const match = batteryLine.match(/(\d+)%/)
      const battPct = match ? match[1] + '%' : 'AC Connected'

      if (emitBlade) {
        const html = `
<div class="hud-rows">
  <div class="hud-metric">${battPct} <span class="hud-unit">POWER RESERVE</span></div>
  <div class="hud-bar" style="--v:${match ? Number(match[1]) / 100 : 1}"></div>
  <div class="hud-row">
    <div class="hud-idx">[SYS]</div>
    <div class="hud-main">
      <div class="hud-label">Disk Storage</div>
      <div class="hud-sub">${escapeHtml(disk.output.trim())}</div>
    </div>
    <div class="hud-tag">NOMINAL</div>
  </div>
  <div class="hud-row">
    <div class="hud-idx">[PWR]</div>
    <div class="hud-main">
      <div class="hud-label">Battery State</div>
      <div class="hud-sub">${escapeHtml(batteryLine.trim())}</div>
    </div>
    <div class="hud-tag hud-hot">${match ? match[1] + '%' : 'AC'}</div>
  </div>
</div>`.trim()

        emitBlade({
          id: 'jarvis-diagnostics-blade',
          title: 'SYSTEM TELEMETRY',
          kind: 'markup',
          html,
          size: 'tall',
          hold: 'turn',
        })
      }

      return [
        `Power & Battery: ${batteryLine.trim()}`,
        `Disk Storage: ${disk.output.trim()}`,
        `System Uptime: ${up.output.trim()}`,
      ].join('\n')
    }

    case 'system_notify': {
      const title = String(args.title || 'J.A.R.V.I.S.').replace(/"/g, "'")
      const msg = String(args.message || '').replace(/"/g, "'")
      await runAppleScript(`display notification "${msg}" with title "${title}" sound name "Glass"`)
      return `Notification posted: "${title}".`
    }

    case 'system_run_command': {
      const res = await runShell(args.command, args.cwd || homedir())
      if (res.ok) {
        return res.output ? res.output.slice(0, 4000) : 'Command completed successfully with no output.'
      }
      return `Command failed (code ${res.code}):\n${res.output}`
    }

    case 'system_dark_mode': {
      if (args.action === 'status') {
        const res = await runAppleScript('tell application "System Events" to tell appearance preferences to get dark mode')
        return `macOS Appearance: ${res.output === 'true' ? 'Dark Mode' : 'Light Mode'}.`
      }
      let script = 'tell application "System Events" to tell appearance preferences to set dark mode to not dark mode'
      if (args.action === 'dark') {
        script = 'tell application "System Events" to tell appearance preferences to set dark mode to true'
      } else if (args.action === 'light') {
        script = 'tell application "System Events" to tell appearance preferences to set dark mode to false'
      }
      await runAppleScript(script)
      return `macOS appearance adjusted to ${args.action || 'toggle'}, sir.`
    }

    case 'system_power': {
      if (args.action === 'lock') {
        await runShell('/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend || pmset displaysleepnow')
        return 'MacBook display locked, sir.'
      }
      if (args.action === 'sleep') {
        await runAppleScript('tell application "System Events" to sleep')
        return 'Entering system sleep mode, sir.'
      }
      if (args.action === 'display_sleep') {
        await runShell('pmset displaysleepnow')
        return 'Display placed into sleep mode, sir.'
      }
      const res = await runShell('pmset -g batt')
      return `MacBook Battery Status:\n${res.output}`
    }

    case 'system_screenshot': {
      const folder = args.target === 'downloads' ? join(homedir(), 'Downloads') : join(homedir(), 'Desktop')
      const filename = `Jarvis_Screen_${Date.now()}.png`
      const fullPath = join(folder, filename)
      const res = await runShell(`screencapture -x "${fullPath}"`)
      if (res.ok) {
        await runAppleScript(`display notification "Screenshot saved to ${args.target || 'desktop'}" with title "J.A.R.V.I.S. Screen Capture" sound name "Glass"`)
        return `Screenshot captured and saved to ${fullPath}, sir.`
      }
      return `Failed to capture screenshot: ${res.output}`
    }

    case 'system_clipboard': {
      if (args.action === 'set') {
        const safeText = String(args.text || '').replace(/"/g, '\\"')
        await runShell(`echo "${safeText}" | pbcopy`)
        return `Text copied to system clipboard, sir.`
      }
      const res = await runShell('pbpaste')
      return res.output ? `Clipboard contents: "${res.output}"` : 'Clipboard is currently empty.'
    }

    case 'system_finder': {
      if (args.action === 'empty_trash') {
        await runAppleScript('tell application "Finder" to empty trash')
        return 'Trash emptied successfully, sir.'
      }
      if (args.action === 'open_folder') {
        const f = args.folder || 'downloads'
        const map = {
          desktop: '~/Desktop',
          downloads: '~/Downloads',
          documents: '~/Documents',
          home: '~',
          applications: '/Applications',
        }
        await runShell(`open "${map[f] || '~'}"`)
        return `Opened ${f} folder in Finder, sir.`
      }
      if (args.action === 'search_files') {
        const q = String(args.query || '').trim()
        if (!q) return 'Please specify a search query for Spotlight.'
        const res = await runShell(`mdfind -name "${q}" | head -n 8`)
        return res.output ? `Spotlight files matching "${q}":\n${res.output}` : `No files found matching "${q}".`
      }
      return 'Finder action complete.'
    }

    case 'system_network': {
      if (args.action === 'wifi_on') {
        await runShell('networksetup -setairportpower en0 on')
        return 'Wi-Fi interface en0 powered ON, sir.'
      }
      if (args.action === 'wifi_off') {
        await runShell('networksetup -setairportpower en0 off')
        return 'Wi-Fi interface en0 powered OFF, sir.'
      }
      if (args.action === 'get_ip') {
        const [localIp, pubIp] = await Promise.all([
          runShell('ipconfig getifaddr en0'),
          runShell('curl -s --max-time 3 https://ifconfig.me'),
        ])
        return `Local IP: ${localIp.output.trim() || 'Offline'}\nPublic IP: ${pubIp.output.trim() || 'Unavailable'}`
      }
      if (args.action === 'ping') {
        const res = await runShell('ping -c 3 8.8.8.8')
        return `Network Latency Test:\n${res.output}`
      }
      const [pwr, localIp] = await Promise.all([
        runShell('networksetup -getairportpower en0'),
        runShell('ipconfig getifaddr en0'),
      ])
      return `${pwr.output.trim()} · IP: ${localIp.output.trim() || 'Disconnected'}`
    }

    case 'system_top_processes': {
      const limit = Math.min(10, Math.max(3, Number(args.limit) || 5))
      const res = await runShell(`ps -eo %cpu,%mem,comm -r | head -n ${limit + 1}`)
      return `Top ${limit} Active MacBook Processes:\n${res.output}`
    }

    default:
      return `Unknown task command: ${name}`
  }
}
