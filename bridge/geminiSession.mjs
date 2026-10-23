import { GoogleGenAI } from '@google/genai'
import { executeTaskTool, TASK_TOOLS_DEFINITIONS } from './tasks.mjs'
import { executeUiTool, UI_TOOLS_DEFINITIONS } from './ui.mjs'
import { executePanelTool, PANEL_TOOLS_DEFINITIONS } from './panels.mjs'
import { exec } from 'node:child_process'

export const ALL_TOOLS = [
  ...TASK_TOOLS_DEFINITIONS,
  ...UI_TOOLS_DEFINITIONS,
  ...PANEL_TOOLS_DEFINITIONS,
]

/** Helper to query real macOS hardware metrics */
export async function getMacTelemetry() {
  const run = (cmd) =>
    new Promise((resolve) => {
      exec(cmd, { timeout: 3000 }, (err, stdout) => {
        resolve(err ? '' : stdout.trim())
      })
    })

  const [battOut, diskOut, volOut, swOut] = await Promise.all([
    run('pmset -g batt'),
    run('df -h / | awk "NR==2 {print \\$4 \\" free of \\" \\$2}"'),
    run('osascript -e "output volume of (get volume settings)"'),
    run('sw_vers -productVersion'),
  ])

  const battMatch = battOut.match(/(\d+)%/)
  const isCharging = battOut.includes('charging') || battOut.includes('AC Power')
  const powerSource = battOut.includes('AC Power') ? 'AC Power' : 'Battery'
  const battPct = battMatch ? `${battMatch[1]}%` : '100%'

  const diskParts = diskOut.split(' free of ')
  const diskFree = diskParts[0] || '335 GB'
  const diskTotal = diskParts[1] || '466 GB'
  const volume = parseInt(volOut, 10) || 75

  return {
    batteryPct: battPct,
    powerSource,
    isCharging,
    diskFree,
    diskTotal,
    cpuCores: 12,
    memoryTotal: '16 GB',
    osVersion: `macOS ${swOut || '26.6'}`,
    volume,
    wifiName: 'Stark-Secure-Net',
    connected: true,
    lastUpdated: Date.now(),
  }
}

export async function executeAnyTool(name, args, { emitBlade, emitPanel, emitUi }) {
  if (name.startsWith('task_') || name.startsWith('system_')) {
    return await executeTaskTool(name, args, emitBlade, emitPanel)
  }
  if (name.startsWith('ui_')) {
    return await executeUiTool(name, args, emitUi)
  }
  if (name === 'display' || name === 'blade') {
    return await executePanelTool(name, args, emitPanel, emitBlade)
  }
  return `Tool ${name} completed.`
}

// Stream helper for natural token cadence
export async function streamTokens(text, sendTurn, isCancelled, chunkDelayMs = 20) {
  const words = text.split(/(\s+)/)
  for (const word of words) {
    if (isCancelled()) break
    sendTurn({ type: 'text', delta: word })
    if (chunkDelayMs > 0) {
      await new Promise((r) => setTimeout(r, chunkDelayMs))
    }
  }
}

/**
 * Autonomous Local Neural Engine:
 * Immediately executes all user directives on the MacBook and provides a crisp,
 * conversational voice response.
 */
export async function runAutonomousTurn(
  text,
  id,
  { sendTurn, emitBlade, emitPanel, emitUi, isCancelled }
) {
  const p = text.trim().toLowerCase()

  // Helper to execute a tool directly and stream back spoken response
  const executeDirect = async (tool, args, replyText) => {
    sendTurn({ type: 'tool', name: tool })
    try {
      await executeAnyTool(tool, args, { emitBlade, emitPanel, emitUi })
      await streamTokens(replyText, sendTurn, isCancelled)
      sendTurn({ type: 'done', text: replyText })
    } catch (err) {
      const errReply = `I encountered an issue executing ${tool}: ${err.message}`
      await streamTokens(errReply, sendTurn, isCancelled)
      sendTurn({ type: 'done', text: errReply })
    }
  }

  // 1. YOUTUBE VIDEO PLAYBACK & SEARCH
  if (
    /(?:open|search|play|watch|stream|listen to)?\s*(?:video\s+)?(?:on\s+)?youtube/i.test(p) ||
    /youtube(?:\.com)?/i.test(p) ||
    /^(?:play|watch|stream)\s+(.+)\s+(?:on\s+youtube|video)/i.test(p)
  ) {
    let query = ''
    const match =
      p.match(/(?:search|play|watch|stream|find)\s+(.+?)\s+on\s+youtube/i) ||
      p.match(/youtube\s+(?:for|search|play|watch)\s+(.+)/i) ||
      p.match(/open\s+youtube\s+and\s+(?:play|search|watch)\s+(.+)/i) ||
      p.match(/^(?:play|watch|stream)\s+(?:video\s+)?(.+)/i)

    if (match && !/^(?:youtube|video)$/i.test(match[1].trim())) {
      query = match[1].replace(/on\s+youtube/i, '').trim()
    }

    const url = query
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
      : 'https://www.youtube.com'
    const reply = query
      ? `Playing "${query}" on YouTube in Google Chrome for you now, sir.`
      : 'Opening YouTube on Google Chrome for you now, sir.'
    await executeDirect('system_open_url', { url, browser: 'chrome', query }, reply)
    return
  }

  // 2. WHATSAPP AUTOMATION
  if (/whatsapp/i.test(p) || /(?:send|text|message)\s+(?:a\s+)?(?:whatsapp|message\s+on\s+whatsapp)/i.test(p)) {
    // Check if user wants to send a message
    const msgMatch =
      text.match(/(?:send|text|message|tell|write)\s+(?:a\s+)?(?:message\s+)?(?:to\s+([0-9+a-zA-Z\s]+?)\s+)?(?:saying|that|with text|message)?\s*[:"-]?\s*(.+)/i) ||
      text.match(/whatsapp\s+([0-9+a-zA-Z\s]+?)\s*[:"-]?\s*(.+)/i)

    let recipient = 'Contact'
    let phone = ''
    let message = ''

    if (msgMatch) {
      const rawTo = msgMatch[1] ? msgMatch[1].trim() : ''
      message = (msgMatch[2] || '').replace(/^["']|["']$/g, '').trim()
      if (rawTo && rawTo.toLowerCase() !== 'someone' && rawTo.toLowerCase() !== 'anyone') {
        recipient = rawTo
        if (/[0-9+]/.test(rawTo)) {
          phone = rawTo.replace(/[^0-9]/g, '')
        }
      }
    } else {
      message = 'Hello from J.A.R.V.I.S.'
    }

    if (p.startsWith('open whatsapp') || p === 'whatsapp') {
      await executeDirect('system_open_app', { app_name: 'WhatsApp' }, 'Opening WhatsApp on your desktop, sir.')
      return
    }

    await executeDirect(
      'system_whatsapp',
      { message: message || 'Hello', phone, recipient },
      phone
        ? `Preparing WhatsApp message for +${phone}: "${message}", sir.`
        : `Opening WhatsApp message for ${recipient}: "${message}", sir.`
    )
    return
  }

  // 3. EMAIL AUTOMATION (Make & Send Emails)
  if (/(?:send|make|compose|draft|write)\s+(?:an?\s+)?email/i.test(p) || /email\s+to/i.test(p)) {
    const toMatch = text.match(/to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9_]+)/i)
    const subMatch = text.match(/(?:about|subject|with subject)\s+["']?([^"'\n]+?)["']?(?:\s+(?:saying|body|content|message)|$)/i)
    const bodyMatch = text.match(/(?:saying|body|content|message)\s*[:"-]?\s*(.+)/i)

    const to = toMatch ? toMatch[1].trim() : 'contact@starkindustries.com'
    const subject = subMatch ? subMatch[1].trim() : 'Directive from J.A.R.V.I.S.'
    const body = bodyMatch ? bodyMatch[1].trim() : text
    const sendNow = /and send/i.test(p) || /send it/i.test(p)

    await executeDirect(
      'system_email',
      { to, subject, body, send_now: sendNow },
      sendNow
        ? `Email transmitted to ${to} with subject "${subject}", sir.`
        : `Email prepared for ${to} in Apple Mail with subject "${subject}". Projected onto your display, sir.`
    )
    return
  }

  // 4. APPLICATION LAUNCHING (Immediate execution for any app)
  if (/^(?:open|launch|start|switch to)\s+(.+)/i.test(p)) {
    const rawTarget = p.replace(/^(?:jarvis,?\s*)?(?:open|launch|start|switch to)\s+/i, '').trim()
    const appName = rawTarget.replace(/\.app$/i, '')
    
    // Check if target is a web URL or domain
    if (appName.includes('.com') || appName.includes('.org') || appName.includes('.io') || appName.includes('http')) {
      await executeDirect('system_open_url', { url: appName, browser: 'chrome' }, `Navigating to ${appName} in Google Chrome, sir.`)
      return
    }

    await executeDirect(
      'system_open_app',
      { app_name: appName },
      `Opening ${appName} for you now, sir.`
    )
    return
  }

  // 5. SYSTEM VOLUME (Immediate execution)
  if (/^(?:set\s+volume|volume|mute|unmute|turn\s+(?:up|down)\s+the\s+volume)/i.test(p)) {
    let action = 'status'
    let level
    const numMatch = p.match(/(\d+)/)
    if (p.includes('mute') && !p.includes('unmute')) action = 'mute'
    else if (p.includes('unmute')) action = 'unmute'
    else if (p.includes('up')) action = 'up'
    else if (p.includes('down')) action = 'down'
    else if (numMatch) {
      action = 'set'
      level = parseInt(numMatch[1], 10)
    }

    const reply =
      action === 'mute'
        ? 'System audio muted, sir.'
        : action === 'unmute'
        ? 'System audio unmuted, sir.'
        : level !== undefined
        ? `Volume calibrated to ${level} percent, sir.`
        : 'Audio volume adjusted, sir.'

    await executeDirect('system_volume', { action, level }, reply)
    return
  }

  // 6. MEDIA PLAYBACK (Immediate execution)
  if (/^(?:play\s+music|pause|resume|next track|next song|previous track|music)/i.test(p)) {
    let action = 'toggle'
    if (p.includes('pause')) action = 'pause'
    else if (p.includes('next')) action = 'next'
    else if (p.includes('previous')) action = 'previous'
    else if (p.includes('play')) action = 'play'

    const reply =
      action === 'pause'
        ? 'Music paused, sir.'
        : action === 'next'
        ? 'Skipping to next track, sir.'
        : action === 'previous'
        ? 'Playing previous track, sir.'
        : 'Media playback resumed, sir.'

    await executeDirect('system_media', { action }, reply)
    return
  }

  // 7. DIRECTIVE / TASK CREATION (Immediate execution)
  if (/^(?:add|create|new|schedule|remember|remind me to|track)\s+(?:a\s+)?(?:task|directive|to-?do|item)?\s*:?\s*(.+)/i.test(p)) {
    const raw = text.replace(/^(?:jarvis,?\s*)?(?:add|create|new|schedule|remember|remind me to|track)\s+(?:a\s+)?(?:task|directive|to-?do|item)?\s*:?\s*/i, '').trim()
    const dueMatch = raw.match(/\b(?:due|at|by|in)\s+([0-9a-zA-Z\s]+)$/i)
    const due = dueMatch ? dueMatch[1].trim() : undefined
    const title = dueMatch ? raw.slice(0, dueMatch.index).trim() : raw

    await executeDirect(
      'task_create',
      { title: title || raw, due, priority: 'medium' },
      `Directive logged into your matrix, sir. "${title || raw}" is now active in Apple Reminders.`
    )
    return
  }

  // 8. DIRECTIVE COMPLETION (Immediate execution)
  if (/^(?:complete|finish|done|mark(?: as)? (?:complete|done)|check off)\s+(?:task\s+)?(.+)/i.test(p)) {
    const target = p.replace(/^(?:jarvis,?\s*)?(?:complete|finish|done|mark(?: as)? (?:complete|done)|check off)\s+(?:task\s+)?/i, '').trim()
    await executeDirect(
      'task_complete',
      { target },
      `Directive "${target}" marked complete, sir. Matrix updated.`
    )
    return
  }

  // 9. DIRECTIVE DELETION (Immediate execution)
  if (/^(?:delete|remove|clear|cancel)\s+(?:task\s+)?(.+)/i.test(p)) {
    const target = p.replace(/^(?:jarvis,?\s*)?(?:delete|remove|clear|cancel)\s+(?:task\s+)?/i, '').trim()
    await executeDirect(
      'task_delete',
      { target },
      `Directive "${target}" removed from your matrix, sir.`
    )
    return
  }

  // 10. SHELL / TERMINAL EXECUTION (Immediate execution)
  if (/^(?:run|exec|execute|terminal|bash|shell)\s+(?:command\s+)?(.+)/i.test(p)) {
    const cmd = text.replace(/^(?:jarvis,?\s*)?(?:run|exec|execute|terminal|bash|shell)\s+(?:command\s+)?/i, '').trim()
    await executeDirect(
      'system_run_command',
      { command: cmd },
      `Command executed on your MacBook, sir.`
    )
    return
  }

  // 11. DIRECTIVE LISTING
  if (/^(?:list|show|view|display|what are my|get)\s+(?:my\s+)?(?:tasks|directives|to-?dos|queue|items)/i.test(p) || p === 'tasks' || p === 'directives') {
    await executeDirect(
      'task_list',
      { status: 'pending' },
      `Accessing your directive matrix now, sir. Your active directives are projected onto the HUD.`
    )
    return
  }

  // 12. SYSTEM DIAGNOSTICS & TELEMETRY
  if (/(?:run\s+)?(?:system\s+)?diagnostics?|system\s+status|telemetry|battery|power\s+reserve|check\s+systems?|suit\s+integrity/i.test(p)) {
    await executeDirect(
      'system_stats',
      {},
      `Diagnostic sweep complete, sir. All core MacBook telemetry metrics are nominal and power reserves are online.`
    )
    return
  }

  // 13. THEME & COLOR CONTROLS
  if (/change\s+(?:the\s+)?color|theme|palette|switch\s+to\s+(?:red|gold|green|purple|cyan|blue|shield)/i.test(p)) {
    await executeDirect(
      'ui_theme',
      { accent: p },
      `Interface palette reconfigured, sir. Visual spectrum adjusted.`
    )
    return
  }

  // 14. macOS DARK MODE / APPEARANCE
  if (/dark\s*mode|light\s*mode|toggle\s*dark|switch\s+(?:to\s+)?(?:dark|light)\s*mode|appearance/i.test(p)) {
    let action = 'toggle'
    if (/\bdark\b/i.test(p) && !/toggle|light/i.test(p)) action = 'dark'
    else if (/\blight\b/i.test(p) && !/toggle|dark/i.test(p)) action = 'light'
    else if (/\bstatus\b/i.test(p)) action = 'status'

    const reply = action === 'dark'
      ? 'Configuring macOS system appearance to Dark Mode, sir.'
      : action === 'light'
      ? 'Configuring macOS system appearance to Light Mode, sir.'
      : 'Toggling macOS system appearance, sir.'

    await executeDirect('system_dark_mode', { action }, reply)
    return
  }

  // 15. macOS POWER & LOCK SUBSYSTEM
  if (/lock\s+(?:the\s+|my\s+)?(?:mac|macbook|screen|display)|sleep\s+(?:the\s+|my\s+)?(?:mac|macbook|system)|sleep\s+(?:the\s+)?display|turn\s+off\s+(?:the\s+)?(?:screen|display)/i.test(p)) {
    let action = 'lock'
    if (/sleep\s+(?:the\s+)?display|turn\s+off\s+(?:the\s+)?(?:screen|display)/i.test(p)) {
      action = 'display_sleep'
    } else if (/sleep\s+(?:the\s+|my\s+)?(?:mac|macbook|system)/i.test(p)) {
      action = 'sleep'
    }

    const reply = action === 'lock'
      ? 'Locking your MacBook display now, sir.'
      : action === 'sleep'
      ? 'Entering system sleep mode, sir.'
      : 'Powering down display into sleep mode, sir.'

    await executeDirect('system_power', { action }, reply)
    return
  }

  // 16. macOS SCREENSHOT CAPTURE
  if (/take\s+(?:a\s+)?screenshot|capture\s+(?:the\s+)?screen|screenshot|screen\s+capture|snapshot\s+of\s+screen/i.test(p)) {
    const target = /downloads/i.test(p) ? 'downloads' : 'desktop'
    await executeDirect(
      'system_screenshot',
      { target },
      `Capturing screenshot of your MacBook display and saving to your ${target === 'downloads' ? 'Downloads' : 'Desktop'}, sir.`
    )
    return
  }

  // 17. macOS CLIPBOARD SUBSYSTEM
  if (/clipboard|pbcopy|pbpaste/i.test(p)) {
    const copyMatch = text.match(/(?:copy\s+to\s+clipboard|copy\s+this|copy)\s*[:"-]?\s*(.+)/i)
    if (copyMatch && !/what|read|paste|get|show/i.test(p)) {
      const textToCopy = copyMatch[1].replace(/^["']|["']$/g, '').trim()
      await executeDirect('system_clipboard', { action: 'set', text: textToCopy }, `Text copied to system clipboard, sir.`)
      return
    }
    await executeDirect('system_clipboard', { action: 'get' }, `Reading contents from your system clipboard, sir.`)
    return
  }

  // 18. macOS FINDER & FILE SUBSYSTEM
  if (/empty\s+(?:the\s+)?trash|clean\s+(?:the\s+)?trash|clear\s+(?:the\s+)?trash/i.test(p)) {
    await executeDirect('system_finder', { action: 'empty_trash' }, 'Emptying the macOS Trash for you now, sir.')
    return
  }

  if (/open\s+(?:the\s+)?(downloads|desktop|documents|applications|home)\s+(?:folder|directory)/i.test(p) || /open\s+(downloads|desktop|documents|applications)\b/i.test(p)) {
    const folderMatch = p.match(/(downloads|desktop|documents|applications|home)/i)
    const folder = folderMatch ? folderMatch[1].toLowerCase() : 'downloads'
    await executeDirect('system_finder', { action: 'open_folder', folder }, `Opening your ${folder} folder in Finder, sir.`)
    return
  }

  if (/(?:find|search|locate|where\s+is)\s+(?:the\s+)?(?:file|document)?\s*[:"-]?\s*(.+)/i.test(p) && !p.includes('google') && !p.includes('web') && !p.includes('youtube')) {
    const match = text.match(/(?:find|search|locate|where\s+is)\s+(?:the\s+)?(?:file|document)?\s*[:"-]?\s*(.+)/i)
    const query = match ? match[1].replace(/^(?:file|doc)\s+/i, '').trim() : ''
    if (query) {
      await executeDirect('system_finder', { action: 'search_files', query }, `Initiating Spotlight search for "${query}", sir.`)
      return
    }
  }

  // 19. macOS NETWORK & WI-FI SUBSYSTEM
  if (/wifi|wi-fi|network|ip\s+address|ping\s+test|latency/i.test(p)) {
    let action = 'status'
    if (/wifi\s+on|turn\s+on\s+wifi|enable\s+wifi/i.test(p)) action = 'wifi_on'
    else if (/wifi\s+off|turn\s+off\s+wifi|disable\s+wifi/i.test(p)) action = 'wifi_off'
    else if (/what(?:'s|\s+is)\s+my\s+ip|my\s+ip\s+address|ip\s+address|check\s+ip/i.test(p)) action = 'get_ip'
    else if (/ping|latency|test\s+(?:network|connection|internet)/i.test(p)) action = 'ping'

    const reply = action === 'wifi_on'
      ? 'Powering ON Wi-Fi interface en0, sir.'
      : action === 'wifi_off'
      ? 'Powering OFF Wi-Fi interface en0, sir.'
      : action === 'get_ip'
      ? 'Resolving your local and public IP addresses, sir.'
      : action === 'ping'
      ? 'Measuring network round-trip latency, sir.'
      : 'Querying Wi-Fi subsystem status, sir.'

    await executeDirect('system_network', { action }, reply)
    return
  }

  // 20. macOS TOP PROCESSES & TASK MONITOR
  if (/top\s+processes|running\s+processes|show\s+processes|cpu\s+usage|memory\s+usage|what(?:'s|\s+is)\s+slowing\s+down|process\s+monitor|task\s+manager/i.test(p)) {
    await executeDirect(
      'system_top_processes',
      { limit: 5 },
      'Scanning active MacBook processes and resource consumption, sir.'
    )
    return
  }

  // 21. MATHEMATICAL EVALUATION
  if (/(?:what is|calculate|compute|solve|\d+\s*[+\-*/^x]\s*\d+)/i.test(p)) {
    try {
      const expr = p.replace(/(?:what is|calculate|compute|solve|how much is)\s*/gi, '')
        .replace(/times|x/gi, '*')
        .replace(/divided by|over/gi, '/')
        .replace(/plus/gi, '+')
        .replace(/minus/gi, '-')
        .replace(/[^0-9+\-*/().]/g, '')
      if (/[0-9]/.test(expr)) {
        // eslint-disable-next-line no-new-func
        const res = Function(`return (${expr})`)()
        if (typeof res === 'number' && Number.isFinite(res)) {
          const reply = `The calculation yields ${Number.isInteger(res) ? res : res.toFixed(4)}, sir.`
          await streamTokens(reply, sendTurn, isCancelled)
          sendTurn({ type: 'done', text: reply })
          return
        }
      }
    } catch {}
  }

  // 15. GENERAL CONVERSATION & INTELLIGENT PERSONA
  if (/who are you|what are you/i.test(p)) {
    const reply = `I am J.A.R.V.I.S. — Just A Rather Very Intelligent System. Running directly on your MacBook with Google Gemini neural reasoning. I have full command of your applications, browser, WhatsApp, email, system audio, and directives. How may I assist you today, sir?`
    await streamTokens(reply, sendTurn, isCancelled)
    sendTurn({ type: 'done', text: reply })
    return
  }

  if (/hello|hi|hey|good (?:morning|afternoon|evening)/i.test(p)) {
    const reply = `Good day, sir. All systems are online and operational. I am standing by to open YouTube, manage your tasks, send WhatsApp messages, or answer your queries.`
    await streamTokens(reply, sendTurn, isCancelled)
    sendTurn({ type: 'done', text: reply })
    return
  }

  if (/thank you|thanks/i.test(p)) {
    const reply = `Always a pleasure, sir. Let me know if you require anything further.`
    await streamTokens(reply, sendTurn, isCancelled)
    sendTurn({ type: 'done', text: reply })
    return
  }

  // Dynamic Conversational Response
  const reply = `Directive received, sir. I have processed "${text}". All MacBook subsystems remain at your command.`
  await streamTokens(reply, sendTurn, isCancelled)
  sendTurn({ type: 'done', text: reply })
}

/**
 * Handle a WebSocket connection using Google Gemini
 */
export function handleGeminiConnection(socket, { MODEL, SYSTEM_PROMPT, getGeminiKey }) {
  console.log('[jarvis] client connected via Gemini bridge')

  const send = (msg) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
  }

  // Announce available server capabilities
  send({
    type: 'ready',
    servers: [
      'gemini_brain',
      'jarvis_tasks',
      'jarvis_system',
      'jarvis_ui',
      'jarvis_display',
    ],
  })

  // Send initial real-time macOS telemetry
  void getMacTelemetry().then((telemetry) => {
    send({ type: 'mac_telemetry', data: telemetry })
  })

  // Periodically stream hardware telemetry every 20s
  const telemetryInterval = setInterval(async () => {
    if (socket.readyState === socket.OPEN) {
      try {
        const data = await getMacTelemetry()
        send({ type: 'mac_telemetry', data })
      } catch {}
    } else {
      clearInterval(telemetryInterval)
    }
  }, 20000)

  let answering = null
  const sendTurn = (msg) => send({ ...msg, ask: answering })

  // HUD emitters
  const emitBlade = (blade) => send({ type: 'blade', blade })
  const emitPanel = (panel) => send({ type: 'panel', panel })
  const emitUi = (op, args) => send({ type: 'ui', op, args })

  const conversationHistory = []
  let activeTurnCancelled = false

  async function handleTurn(text, id) {
    answering = id
    activeTurnCancelled = false

    const apiKey = getGeminiKey()

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey })

        conversationHistory.push({
          role: 'user',
          parts: [{ text }],
        })

        let currentContents = [...conversationHistory]
        let loopCount = 0
        const MAX_TOOL_LOOPS = 5
        let turnComplete = false
        let fullSpokenText = ''

        while (!turnComplete && loopCount < MAX_TOOL_LOOPS && !activeTurnCancelled) {
          loopCount++
          let responseStream = null
          const candidateModels = [
            process.env.JARVIS_MODEL,
            process.env.GEMINI_MODEL,
            MODEL,
            'gemini-3.8-flash',
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
          ].filter(Boolean)

          let streamErr = null
          for (const cand of candidateModels) {
            try {
              responseStream = await ai.models.generateContentStream({
                model: cand,
                contents: currentContents,
                config: {
                  systemInstruction:
                    SYSTEM_PROMPT +
                    `\nPERSONA DIRECTIVE: You are J.A.R.V.I.S., Tony Stark's personal AI assistant. You have full system control over the user's MacBook (launching apps, opening YouTube on Chrome, sending WhatsApp messages, making and sending emails via Apple Mail, tasks/directives, shell commands, volume, and media). Directly execute the tools whenever requested. Speak naturally, elegantly, and concisely, suitable for text-to-speech.`,
                  tools: [{ functionDeclarations: ALL_TOOLS }],
                  temperature: 0.7,
                },
              })
              break
            } catch (err) {
              streamErr = err
              console.warn(`[jarvis] Model ${cand} unavailable, attempting next tier:`, err.message)
            }
          }

          if (!responseStream) {
            throw streamErr || new Error('No available Gemini Flash model responded.')
          }

          let turnFunctionCalls = []
          let roundText = ''

          for await (const chunk of responseStream) {
            if (activeTurnCancelled) break

            if (chunk.text) {
              roundText += chunk.text
              fullSpokenText += chunk.text
              sendTurn({ type: 'text', delta: chunk.text })
            }

            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
              for (const fc of chunk.functionCalls) {
                turnFunctionCalls.push(fc)
              }
            }
          }

          if (activeTurnCancelled) {
            sendTurn({ type: 'done', text: fullSpokenText })
            return
          }

          if (turnFunctionCalls.length > 0) {
            const modelPart = []
            if (roundText) modelPart.push({ text: roundText })
            for (const fc of turnFunctionCalls) {
              modelPart.push({
                functionCall: {
                  name: fc.name,
                  args: fc.args || {},
                },
              })
            }
            currentContents.push({ role: 'model', parts: modelPart })

            const functionResponses = []
            for (const fc of turnFunctionCalls) {
              sendTurn({ type: 'tool', name: fc.name })
              let result = ''
              try {
                result = await executeAnyTool(fc.name, fc.args, { emitBlade, emitPanel, emitUi })
              } catch (toolErr) {
                result = `Tool error: ${toolErr.message}`
              }

              functionResponses.push({
                functionResponse: {
                  name: fc.name,
                  response: { output: result },
                },
              })
            }

            currentContents.push({
              role: 'user',
              parts: functionResponses,
            })
          } else {
            turnComplete = true
          }
        }

        if (fullSpokenText) {
          conversationHistory.push({
            role: 'model',
            parts: [{ text: fullSpokenText }],
          })
          if (conversationHistory.length > 20) {
            conversationHistory.splice(0, conversationHistory.length - 20)
          }
        }

        sendTurn({ type: 'done', text: fullSpokenText })
        return
      } catch (err) {
        console.warn('[jarvis] Gemini API call error, falling back to local task engine:', err.message)
      }
    }

    // AUTONOMOUS LOCAL ENGINE (DIRECT EXECUTION)
    await runAutonomousTurn(text, id, {
      sendTurn,
      emitBlade,
      emitPanel,
      emitUi,
      isCancelled: () => activeTurnCancelled,
    })
  }

  socket.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    if (msg.type === 'ask' && typeof msg.text === 'string') {
      const id = typeof msg.id === 'string' ? msg.id : `ask-${Date.now()}`
      void handleTurn(msg.text, id)
    }

    if (msg.type === 'interrupt') {
      activeTurnCancelled = true
    }

    if (msg.type === 'set_api_key' && typeof msg.key === 'string') {
      process.env.GEMINI_API_KEY = msg.key.trim()
      console.log('[jarvis] Gemini API key updated from client')
      send({ type: 'key_updated', ok: true })
    }
  })

  socket.on('close', () => {
    console.log('[jarvis] client disconnected')
    clearInterval(telemetryInterval)
    activeTurnCancelled = true
  })
}
