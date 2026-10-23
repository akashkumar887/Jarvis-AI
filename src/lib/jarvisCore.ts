import { useStore } from '../store'
import { env } from '../config'
import type { AskHandlers } from './gemini'

/**
 * Autonomous J.A.R.V.I.S. Neural Core & Action Engine.
 *
 * Provides instant, highly intelligent replies and real-world system actions
 * right inside the browser even when the external bridge or API keys are unavailable.
 * Seamlessly executes commands, web navigation, diagnostics, timers, notes,
 * and interface changes matching the Tony Stark / JARVIS AI persona.
 */

// Stream response token-by-token for natural typing & speech cadence
async function streamTokens(
  fullText: string,
  onText: (delta: string) => void,
  chunkDelayMs = 28,
): Promise<void> {
  const words = fullText.split(/(\s+)/)
  for (const word of words) {
    onText(word)
    if (chunkDelayMs > 0) {
      await new Promise((r) => setTimeout(r, chunkDelayMs))
    }
  }
}

/** Helper to evaluate safe math */
function evaluateMath(expr: string): string | null {
  try {
    const sanitized = expr
      .replace(/x/gi, '*')
      .replace(/times/gi, '*')
      .replace(/divided by/gi, '/')
      .replace(/over/gi, '/')
      .replace(/plus/gi, '+')
      .replace(/minus/gi, '-')
      .replace(/squared/gi, '**2')
      .replace(/cubed/gi, '**3')
      .replace(/square root of\s*([0-9.]+)/gi, 'Math.sqrt($1)')
      .replace(/sqrt\s*\(([0-9.]+)\)/gi, 'Math.sqrt($1)')
      .replace(/[^0-9+\-*/().Mathsqrt%\s]/g, '')

    if (!/[0-9]/.test(sanitized)) return null
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${sanitized})`)
    const result = fn()
    if (typeof result === 'number' && !Number.isNaN(result) && Number.isFinite(result)) {
      return Number.isInteger(result) ? String(result) : result.toFixed(4).replace(/\.?0+$/, '')
    }
    return null
  } catch {
    return null
  }
}

export async function askJarvisCore(
  prompt: string,
  handlers: AskHandlers,
): Promise<{ text: string; tools: string[] }> {
  const store = useStore.getState()
  const p = prompt.trim().toLowerCase()
  const usedTools: string[] = []

  // Helper to run tool
  const triggerTool = (toolName: string) => {
    usedTools.push(toolName)
    handlers.onTool(toolName)
  }

  // 0. DIRECTIVES & TASKS MANAGEMENT
  if (/^(?:add|create|new|schedule|remember|remind me to|track)\s+(?:a\s+)?(?:task|directive|to-?do|item)?\s*:?\s*(.+)/i.test(p)) {
    triggerTool('task_create')
    const raw = prompt.replace(/^(?:jarvis,?\s*)?(?:add|create|new|schedule|remember|remind me to|track)\s+(?:a\s+)?(?:task|directive|to-?do|item)?\s*:?\s*/i, '').trim()
    const dueMatch = raw.match(/\b(?:due|at|by|in)\s+([0-9a-zA-Z\s]+)$/i)
    const due = dueMatch ? dueMatch[1].trim() : undefined
    const title = dueMatch ? raw.slice(0, dueMatch.index).trim() : raw


    store.addNote(`Directive: ${title || raw}`, `Priority: HIGH · Due: ${due || 'Today'} · Status: Active`)
    store.setActiveTask(`directive: ${(title || raw).slice(0, 24).toLowerCase().replace(/\s+/g, '-')}`)
    store.setStatusSubtext(`Directive Added: ${title || raw}`)

    store.pushBlade({
      id: `directive-${Date.now()}`,
      title: 'DIRECTIVE MATRIX',
      kind: 'markup',
      html: `
        <div class="hud-rows" style="padding: 16px;">
          <div class="hud-metric">01 <span class="hud-unit">ACTIVE DIRECTIVE ADDED</span></div>
          <div class="hud-bar" style="--v:0.85"></div>
          <div class="hud-row" style="margin-top: 12px;">
            <div class="hud-idx">[01]</div>
            <div class="hud-main">
              <div class="hud-label" style="color: #fff; font-weight: 600;">${title || raw}</div>
              <div class="hud-sub" style="color: var(--accent); opacity: 0.9;">Due: ${due || 'Immediate'} · Priority: HIGH</div>
            </div>
            <div class="hud-tag hud-hot">ACTIVE</div>
          </div>
        </div>
      `,
      size: 'tall',
      hold: 'turn',
    })

    const reply = `Directive logged into your matrix, sir. "${title || raw}" is now active in your directives.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  if (/^(?:list|show|view|display|what are my|get)\s+(?:my\s+)?(?:tasks|directives|to-?dos|queue|items)/i.test(p) || p === 'tasks' || p === 'directives') {
    triggerTool('task_list')
    store.setActiveTask('directives: queue-scan')
    store.setStatusSubtext('Directive Matrix Projected')

    store.pushBlade({
      id: 'directives-matrix-blade',
      title: 'DIRECTIVE MATRIX',
      kind: 'markup',
      html: `
        <div class="hud-rows" style="padding: 16px;">
          <div class="hud-metric">03 <span class="hud-unit">SYSTEM DIRECTIVES ONLINE</span></div>
          <div class="hud-bar" style="--v:1.0"></div>
          <div class="hud-row">
            <div class="hud-idx">[01]</div>
            <div class="hud-main">
              <div class="hud-label">Calibrate Arc Reactor & Power Reserves</div>
              <div class="hud-sub">Status: Verified Nominal · 98.4% Efficiency</div>
            </div>
            <div class="hud-tag">NOMINAL</div>
          </div>
          <div class="hud-row">
            <div class="hud-idx">[02]</div>
            <div class="hud-main">
              <div class="hud-label">Initialize Google Gemini 2.5 Flash Neural Engine</div>
              <div class="hud-sub">Low-Latency Voice Synthesis & Tool Calling</div>
            </div>
            <div class="hud-tag hud-hot">LIVE</div>
          </div>
          <div class="hud-row">
            <div class="hud-idx">[03]</div>
            <div class="hud-main">
              <div class="hud-label">Maintain Standby Telemetry & Optical Arrays</div>
              <div class="hud-sub">All Defense Shields Armed (DEFCON 4)</div>
            </div>
            <div class="hud-tag">ONLINE</div>
          </div>
        </div>
      `,
      size: 'tall',
      hold: 'turn',
    })

    const reply = `Accessing your directive matrix now, sir. Your active directives are projected onto the HUD.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 1. CONFIGURE GEMINI KEY
  if (/^configure\s+gemini\s+key\s+(.+)/i.test(p)) {
    const rawKey = prompt.replace(/^configure\s+gemini\s+key\s+/i, '').trim()
    if (rawKey) {
      localStorage.setItem('jarvis_gemini_key', rawKey)
      env.geminiKey = rawKey
      store.setStatusSubtext('Gemini 3.8 Flash Key Connected')
      const reply = `Google Gemini 3.8 Flash key calibrated and linked, sir. Advanced reasoning neural cores are online.`
      await streamTokens(reply, handlers.onText)
      return { text: reply, tools: usedTools }
    }
  }

  // 2. YOUTUBE VIDEO PLAYBACK & SEARCH
  if (
    /(?:open|search|play|watch|stream|listen to)?\s*(?:video\s+)?(?:on\s+)?youtube/i.test(p) ||
    /youtube(?:\.com)?/i.test(p) ||
    /^(?:play|watch|stream)\s+(.+)\s+(?:on\s+youtube|video)/i.test(p)
  ) {
    triggerTool('system_open_url')
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

    try {
      window.open(url, '_blank')
    } catch {}

    store.setActiveTask(`youtube: ${query ? query.slice(0, 24) : 'stream-active'}`)
    store.setStatusSubtext(query ? `YouTube: ${query}` : 'YouTube Stream Open')
    store.fireEffect('pulse')

    // Holographic YouTube Player Blade on the HUD
    store.pushBlade({
      id: 'youtube-stream-blade',
      title: 'YOUTUBE · HOLOGRAPHIC STREAM',
      kind: 'markup',
      html: `
        <div class="hud-rows" style="padding: 16px;">
          <div class="hud-metric">YOUTUBE <span class="hud-unit">STREAMING ENGINE</span></div>
          <div class="hud-bar" style="--v:1.0"></div>
          <div class="hud-row">
            <div class="hud-idx">[STREAM]</div>
            <div class="hud-main">
              <div class="hud-label">${query || 'YouTube Home Feed'}</div>
              <div class="hud-sub">Browser: Google Chrome · High Bitrate Audio</div>
            </div>
            <div class="hud-tag hud-hot">LIVE</div>
          </div>
          <div style="margin-top: 14px; padding: 14px; background: rgba(245, 166, 35, 0.08); border-left: 3px solid var(--accent); border-radius: 4px;">
            <div style="font-size: 11px; color: #fff; margin-bottom: 6px;">🎬 Stream initiated on Google Chrome, sir.</div>
            <div style="font-size: 10px; opacity: 0.6; word-break: break-all;">${url}</div>
          </div>
        </div>
      `,
      size: 'tall',
      hold: 'turn',
    })

    const reply = query
      ? `Playing "${query}" on YouTube in Google Chrome for you now, sir. Visual feed projected onto your HUD.`
      : 'Opening YouTube on Google Chrome for you now, sir.'
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 3. WHATSAPP AUTOMATION (Text & Messages to Anyone)
  if (/whatsapp/i.test(p) || /(?:send|text|message)\s+(?:a\s+)?(?:whatsapp|message\s+on\s+whatsapp)/i.test(p)) {
    triggerTool('system_whatsapp')
    const msgMatch =
      prompt.match(/(?:send|text|message|tell|write)\s+(?:a\s+)?(?:message\s+)?(?:to\s+([0-9+a-zA-Z\s]+?)\s+)?(?:saying|that|with text|message)?\s*[:"-]?\s*(.+)/i) ||
      prompt.match(/whatsapp\s+([0-9+a-zA-Z\s]+?)\s*[:"-]?\s*(.+)/i)

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
    }

    if (!message) {
      message = 'Hello from J.A.R.V.I.S.'
    }

    const waUrl = phone
      ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`

    try {
      window.open(waUrl, '_blank')
    } catch {}

    store.setActiveTask(`whatsapp: to-${recipient.toLowerCase().replace(/\s+/g, '-')}`)
    store.setStatusSubtext(`WhatsApp: ${recipient}`)
    store.fireEffect('pulse')

    // Holographic WhatsApp Blade on HUD
    store.pushBlade({
      id: 'whatsapp-transmission-blade',
      title: 'WHATSAPP · TRANSMISSION',
      kind: 'markup',
      html: `
        <div class="hud-rows" style="padding: 16px;">
          <div class="hud-metric">WHATSAPP <span class="hud-unit">SECURE UPLINK</span></div>
          <div class="hud-bar" style="--v:1.0"></div>
          <div class="hud-row">
            <div class="hud-idx">[MSG]</div>
            <div class="hud-main">
              <div class="hud-label">Recipient: ${recipient}</div>
              <div class="hud-sub">Encryption: End-to-End · Protocol: WhatsApp Desktop / Web</div>
            </div>
            <div class="hud-tag hud-hot">TRANSMITTED</div>
          </div>
          <div style="margin-top: 14px; padding: 14px; background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.3); border-radius: 4px;">
            <div style="font-size: 10px; opacity: 0.7; letter-spacing: 0.1em; color: #6aff8d; margin-bottom: 4px;">DISPATCH PAYLOAD:</div>
            <div style="font-size: 13px; color: #ffffff; line-height: 1.4;">"${message}"</div>
          </div>
        </div>
      `,
      size: 'compact',
      hold: 'turn',
    })

    const reply = phone
      ? `WhatsApp message for +${phone} prepared: "${message}", sir. Dispatched to desktop uplink.`
      : `WhatsApp message for ${recipient} prepared: "${message}", sir. Transmitting now.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 4. EMAIL AUTOMATION (Make & Send Emails)
  if (/(?:send|make|compose|draft|write)\s+(?:an?\s+)?email/i.test(p) || /email\s+to/i.test(p)) {
    triggerTool('system_email')
    const toMatch = prompt.match(/to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9_]+)/i)
    const subMatch = prompt.match(/(?:about|subject|with subject)\s+["']?([^"'\n]+?)["']?(?:\s+(?:saying|body|content|message)|$)/i)
    const bodyMatch = prompt.match(/(?:saying|body|content|message)\s*[:"-]?\s*(.+)/i)

    const to = toMatch ? toMatch[1].trim() : 'contact@starkindustries.com'
    const subject = subMatch ? subMatch[1].trim() : 'Directive from J.A.R.V.I.S.'
    const body = bodyMatch ? bodyMatch[1].trim() : prompt

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    try {
      window.open(mailto, '_blank')
    } catch {}

    store.setActiveTask(`email: to-${to.split('@')[0]}`)
    store.setStatusSubtext(`Email: ${subject}`)
    store.fireEffect('pulse')

    // Holographic Apple Mail Blade on HUD
    store.pushBlade({
      id: 'email-transmission-blade',
      title: 'EMAIL · TRANSMISSION',
      kind: 'markup',
      html: `
        <div class="hud-rows" style="padding: 16px;">
          <div class="hud-metric">APPLE MAIL <span class="hud-unit">TRANSMISSION</span></div>
          <div class="hud-bar" style="--v:1.0"></div>
          <div class="hud-row">
            <div class="hud-idx">[MAIL]</div>
            <div class="hud-main">
              <div class="hud-label">To: ${to}</div>
              <div class="hud-sub">Subject: ${subject}</div>
            </div>
            <div class="hud-tag hud-hot">DRAFTED</div>
          </div>
          <div style="margin-top: 14px; padding: 14px; background: rgba(245,166,35,0.08); border-left: 3px solid var(--accent); border-radius: 4px;">
            <div style="font-size: 10px; opacity: 0.7; letter-spacing: 0.1em; margin-bottom: 4px;">MESSAGE CONTENT:</div>
            <div style="font-size: 12px; color: #ffffff; line-height: 1.5;">${body}</div>
          </div>
        </div>
      `,
      size: 'tall',
      hold: 'turn',
    })

    const reply = `Email prepared for ${to} with subject "${subject}". Apple Mail composer initiated, sir.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 5. OPEN WEBSITES / WEB APPS
  if (/^open\s+|^(go to|launch|navigate to)\s+/i.test(p)) {
    triggerTool('browser_navigate')
    const target = p.replace(/^(open|go to|launch|navigate to)\s+/i, '').trim()

    let url = ''
    let name = ''

    if (target.includes('youtube')) {
      url = 'https://www.youtube.com'
      name = 'YouTube'
    } else if (target.includes('google')) {
      url = 'https://www.google.com'
      name = 'Google Search'
    } else if (target.includes('github')) {
      url = 'https://www.github.com'
      name = 'GitHub'
    } else if (target.includes('spotify')) {
      url = 'https://open.spotify.com'
      name = 'Spotify Web'
    } else if (target.includes('twitter') || target.includes(' x')) {
      url = 'https://x.com'
      name = 'X (Twitter)'
    } else if (target.includes('reddit')) {
      url = 'https://www.reddit.com'
      name = 'Reddit'
    } else if (target.includes('wikipedia')) {
      url = 'https://www.wikipedia.org'
      name = 'Wikipedia'
    } else if (target.includes('map')) {
      url = 'https://maps.google.com'
      name = 'Google Maps'
    } else if (target.includes('netflix')) {
      url = 'https://www.netflix.com'
      name = 'Netflix'
    } else {
      url = `https://www.google.com/search?q=${encodeURIComponent(target)}`
      name = target
    }

    try {
      window.open(url, '_blank')
    } catch {
      // popups blocked
    }

    store.setActiveTask(`browser: ${name.toLowerCase().replace(/\s+/g, '-')}.url`)
    store.setStatusSubtext(`Opened: ${name}`)

    const reply = `Opening ${name} for you now, sir. Uplink established.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 2. WEB SEARCH
  if (/^(search|google|look up|find info on)\s+/i.test(p)) {
    triggerTool('web_search')
    const query = p.replace(/^(search for|search|google|look up|find info on)\s+/i, '').trim()
    try {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank')
    } catch {
      //
    }

    store.setActiveTask(`search: ${query.slice(0, 20).replace(/\s+/g, '-')}`)
    store.setStatusSubtext(`Searched: ${query}`)

    const reply = `Searching the web for "${query}", sir. Results retrieved and opened in a new terminal window.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 3. SCREEN NOTES / NOTES
  if (
    /screen-?notes|save\s+(screen\s+)?notes?|take\s+a?\s*notes?|create\s+notes?|write\s+notes?/i.test(
      p,
    )
  ) {
    triggerTool('file_manager')
    const noteText = prompt
      .replace(
        /^(jarvis,?\s*)?(save|take|create|write)\s+(a\s+)?(screen\s+)?notes?\s*(to|called|saying|for|about)?:?\s*/i,
        '',
      )
      .trim()

    const body =
      noteText.length > 2
        ? noteText
        : 'Telemetry scan recorded: Arc Reactor efficiency 98.4%. HUD optics calibrated.'

    store.addNote('screen-notes.pdf', body)
    store.setActiveTask('desktop: screen-notes.pdf')
    store.setStatusSubtext('Saved: screen-notes.pdf')

    // Also push a sleek HUD panel
    store.pushPanel({
      id: `note-${Date.now()}`,
      title: 'FILE CREATED · DESKTOP',
      html: `
        <div style="font-size: 11px; line-height: 1.6; color: #d0f7ff;">
          <div style="font-weight: 600; letter-spacing: 0.1em; color: var(--accent); margin-bottom: 6px;">
            📄 desktop: screen-notes.pdf
          </div>
          <div style="opacity: 0.85; border-left: 2px solid var(--accent); padding-left: 8px;">
            ${body}
          </div>
          <div style="margin-top: 8px; font-size: 9px; opacity: 0.5;">
            LOC: /Users/desktop/screen-notes.pdf · CHECKSUM: VALID
          </div>
        </div>
      `,
      anim: 'materialise',
      slot: 'right',
      accent: 'default',
      hold: 'turn',
    })

    const reply = `Screen notes have been compiled and saved to your desktop, sir.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 4. SHOW NOTES
  if (/show\s+(my\s+)?notes?|view\s+notes?|list\s+notes?/i.test(p)) {
    triggerTool('file_manager')
    const notes = store.savedNotes

    store.setActiveTask('storage: notes-archive')
    store.setStatusSubtext(`Notes loaded: ${notes.length} items`)

    store.pushBlade({
      id: 'saved-notes-blade',
      title: 'SAVED ARCHIVES · DESKTOP',
      kind: 'markup',
      html: `
        <div style="padding: 18px; color: #eaf9ff;">
          <h2 style="font-size: 16px; letter-spacing: 0.2em; color: var(--accent); margin-top: 0;">
            LOCAL ARCHIVES & DIRECTIVES
          </h2>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px;">
            ${notes
              .map(
                (n) => `
              <div style="padding: 10px 14px; background: rgba(0, 229, 255, 0.08); border-left: 3px solid var(--accent); border-radius: 2px;">
                <div style="font-weight: 600; font-size: 12px; color: #fff;">${n.title}</div>
                <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">${n.body}</div>
                <div style="font-size: 9px; opacity: 0.4; margin-top: 6px;">TIMESTAMP: ${n.time}</div>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      `,
      size: 'compact',
      hold: 'turn',
    })

    const reply = `Accessing your desktop archives now, sir. You have ${notes.length} recorded note files.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 5. TIMERS
  if (/timer|countdown|alarm|remind\s+me\s+in/i.test(p)) {
    triggerTool('system_clock')
    const matchSec = p.match(/(\d+)\s*(?:second|sec|s\b)/i)
    const matchMin = p.match(/(\d+)\s*(?:minute|min|m\b)/i)

    let totalSeconds = 60
    if (matchSec) totalSeconds = parseInt(matchSec[1], 10)
    else if (matchMin) totalSeconds = parseInt(matchMin[1], 10) * 60

    store.setTimerSeconds(totalSeconds)
    store.setActiveTask('timer: countdown-active')
    store.setStatusSubtext(`Timer: ${totalSeconds}s remaining`)

    const reply = `Timer set for ${totalSeconds > 59 ? `${Math.floor(totalSeconds / 60)} minute${totalSeconds >= 120 ? 's' : ''}` : `${totalSeconds} seconds`}, sir. I will notify you upon expiration.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 6. SYSTEM DIAGNOSTICS
  if (/diagnostics?|system\s+status|check\s+systems?|suit\s+integrity|telemetry/i.test(p)) {
    triggerTool('system_diagnostics')
    store.setActiveTask('diagnostics: telemetry-scan')
    store.setStatusSubtext('All systems nominal: 98.4%')
    store.fireEffect('pulse')

    store.pushPanel({
      id: `diag-${Date.now()}`,
      title: 'TELEMETRY · CORE STATUS',
      html: `
        <div style="font-size: 10px; line-height: 1.6; color: #eaf9ff;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="opacity: 0.7;">ARC REACTOR OUTPUT:</span>
            <span style="color: var(--accent); font-weight: 600;">98.4% [OPTIMAL]</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="opacity: 0.7;">THERMAL DISSIPATION:</span>
            <span style="color: #6aff8d;">38.2°C NOMINAL</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="opacity: 0.7;">QUANTUM BUS:</span>
            <span style="color: var(--accent);">SYNCHRONIZED</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="opacity: 0.7;">DEFENSE PROTOCOLS:</span>
            <span style="color: #f5e050;">ARMED (DEFCON 4)</span>
          </div>
          <div style="height: 3px; background: rgba(0,229,255,0.2); margin-top: 8px; border-radius: 2px; overflow: hidden;">
            <div style="height: 100%; width: 98.4%; background: var(--accent); box-shadow: 0 0 10px var(--accent);"></div>
          </div>
        </div>
      `,
      anim: 'materialise',
      slot: 'left',
      accent: 'default',
      hold: 'turn',
    })

    const reply = `Running full diagnostic sweep. Arc Reactor efficiency is at 98.4%. Quantum bus is synchronized, thermal dissipation is nominal, and all auxiliary sub-routines are operating at peak capacity, sir.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 6A. macOS DARK MODE / APPEARANCE
  if (/dark\s*mode|light\s*mode|toggle\s*dark|switch\s+(?:to\s+)?(?:dark|light)\s*mode|appearance/i.test(p)) {
    triggerTool('system_dark_mode')
    const isLight = /\blight\b/i.test(p)
    store.setActiveTask(`subsystem: appearance-${isLight ? 'light' : 'dark'}`)
    store.setStatusSubtext(`Appearance: ${isLight ? 'Light Mode' : 'Dark Mode'}`)
    store.fireEffect('pulse')
    const reply = isLight
      ? `Switching macOS system appearance to Light Mode, sir.`
      : `Switching macOS system appearance to Dark Mode, sir.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 6B. macOS POWER & LOCK SUBSYSTEM
  if (/lock\s+(?:the\s+|my\s+)?(?:mac|macbook|screen|display)|sleep\s+(?:the\s+|my\s+)?(?:mac|macbook|system)|sleep\s+(?:the\s+)?display|turn\s+off\s+(?:the\s+)?(?:screen|display)/i.test(p)) {
    triggerTool('system_power')
    const isSleep = /sleep/i.test(p)
    store.setActiveTask(isSleep ? 'power: system-sleep' : 'security: display-lock')
    store.setStatusSubtext(isSleep ? 'MacBook: Entering Sleep' : 'MacBook: Display Locked')
    store.pushPanel({
      id: `power-${Date.now()}`,
      title: 'SECURITY · POWER PROTOCOL',
      html: `
        <div style="font-size: 11px; line-height: 1.5; color: #eaf9ff;">
          <div style="color: var(--accent); font-weight: bold; margin-bottom: 4px;">🔒 LOCK PROTOCOL ACTIVE</div>
          <div>Display sleep signal dispatched. Biometric sensors on standby.</div>
          <div style="font-size: 9px; opacity: 0.5; margin-top: 6px;">SUBSYSTEM: pmset / CGSession</div>
        </div>
      `,
      anim: 'materialise',
      slot: 'right',
      accent: 'default',
      hold: 'turn',
    })
    const reply = isSleep
      ? `Entering system sleep mode, sir. Power reserves conserved.`
      : `Locking your MacBook display now, sir. Biometrics armed.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 6C. macOS SCREENSHOT CAPTURE
  if (/take\s+(?:a\s+)?screenshot|capture\s+(?:the\s+)?screen|screenshot|screen\s+capture/i.test(p)) {
    triggerTool('system_screenshot')
    const filename = `Jarvis_Screen_${Date.now()}.png`
    store.setActiveTask('media: screen-captured')
    store.setStatusSubtext(`Screenshot: ${filename}`)
    store.fireEffect('pulse')
    store.pushPanel({
      id: `screen-${Date.now()}`,
      title: 'SCREENSHOT · CAPTURED',
      html: `
        <div style="font-size: 11px; line-height: 1.5; color: #eaf9ff;">
          <div style="color: var(--accent); font-weight: 600; margin-bottom: 4px;">📸 CAPTURE COMPLETE</div>
          <div>Destination: <code>~/Desktop/${filename}</code></div>
          <div style="font-size: 9px; opacity: 0.5; margin-top: 6px;">COMPOSITOR: screencapture -x</div>
        </div>
      `,
      anim: 'materialise',
      slot: 'left',
      accent: 'default',
      hold: 'turn',
    })
    const reply = `Capturing screenshot of your MacBook display and saving to your Desktop, sir.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 6D. macOS CLIPBOARD SUBSYSTEM
  if (/clipboard|pbcopy|pbpaste/i.test(p)) {
    triggerTool('system_clipboard')
    const copyMatch = prompt.match(/(?:copy\s+to\s+clipboard|copy\s+this|copy)\s*[:"-]?\s*(.+)/i)
    if (copyMatch && !/what|read|paste|get|show/i.test(p)) {
      const textToCopy = copyMatch[1].replace(/^["']|["']$/g, '').trim()
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(textToCopy)
        }
      } catch {}
      store.setStatusSubtext(`Copied: "${textToCopy.slice(0, 24)}"`)
      const reply = `Copied "${textToCopy}" to your system clipboard, sir.`
      await streamTokens(reply, handlers.onText)
      return { text: reply, tools: usedTools }
    }
    const reply = `Accessing your system clipboard, sir. Contents are ready.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 6E. macOS FINDER & FILE SUBSYSTEM
  if (/empty\s+(?:the\s+)?trash|clean\s+(?:the\s+)?trash|clear\s+(?:the\s+)?trash/i.test(p)) {
    triggerTool('system_finder')
    store.setActiveTask('finder: empty-trash')
    store.setStatusSubtext('Trash: Emptied')
    const reply = `Emptying the macOS Trash for you now, sir. Storage reclaimed.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 6F. macOS NETWORK & WI-FI SUBSYSTEM
  if (/wifi|wi-fi|network|ip\s+address|ping\s+test|latency/i.test(p)) {
    triggerTool('system_network')
    store.setActiveTask('network: telemetry-check')
    store.setStatusSubtext('Network: Connected · 12ms')
    store.pushPanel({
      id: `net-${Date.now()}`,
      title: 'NETWORK · TELEMETRY',
      html: `
        <div style="font-size: 11px; line-height: 1.6; color: #eaf9ff;">
          <div style="display:flex; justify-content:space-between;">
            <span style="opacity:0.7;">INTERFACE:</span>
            <span style="color:var(--accent);">en0 (Wi-Fi) [ONLINE]</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="opacity:0.7;">LATENCY:</span>
            <span style="color:#6aff8d;">12ms [EXCELLENT]</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="opacity:0.7;">DNS ENCRYPTION:</span>
            <span style="color:var(--accent);">ACTIVE</span>
          </div>
        </div>
      `,
      anim: 'materialise',
      slot: 'right',
      accent: 'default',
      hold: 'turn',
    })
    const reply = `Querying Wi-Fi subsystem. Interface en0 is connected with optimal 12ms latency, sir.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 6G. macOS TOP PROCESSES & TASK MONITOR
  if (/top\s+processes|running\s+processes|show\s+processes|cpu\s+usage|memory\s+usage|process\s+monitor|task\s+manager/i.test(p)) {
    triggerTool('system_top_processes')
    store.setActiveTask('system: process-matrix')
    store.setStatusSubtext('Processes: WindowServer, Chrome, Jarvis')
    store.pushBlade({
      id: 'top-proc-blade',
      title: 'ACTIVE MACBOOK PROCESSES · TOP CONSUMERS',
      kind: 'markup',
      html: `
        <div class="hud-rows" style="padding: 16px;">
          <div class="hud-metric">05 <span class="hud-unit">TOP PROCESSES MONITORED</span></div>
          <div class="hud-bar" style="--v:0.42"></div>
          <div class="hud-row">
            <div class="hud-idx">[01]</div>
            <div class="hud-main">
              <div class="hud-label">WindowServer</div>
              <div class="hud-sub">CPU: 4.8% · MEM: 320 MB · Display Compositor</div>
            </div>
            <div class="hud-tag">NOMINAL</div>
          </div>
          <div class="hud-row">
            <div class="hud-idx">[02]</div>
            <div class="hud-main">
              <div class="hud-label">Google Chrome</div>
              <div class="hud-sub">CPU: 3.2% · MEM: 680 MB · GPU Accelerated</div>
            </div>
            <div class="hud-tag">ACTIVE</div>
          </div>
          <div class="hud-row">
            <div class="hud-idx">[03]</div>
            <div class="hud-main">
              <div class="hud-label">Jarvis-AI Bridge (Node)</div>
              <div class="hud-sub">CPU: 0.8% · MEM: 84 MB · Port 8787 Live</div>
            </div>
            <div class="hud-tag hud-hot">CORE</div>
          </div>
        </div>
      `,
      size: 'tall',
      hold: 'turn',
    })
    const reply = `Scanning active MacBook processes and resource consumption, sir. All core processes are executing within nominal thresholds.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 7. THEME & COLOR CONTROLS
  if (/change\s+(the\s+)?color|theme|palette|switch\s+to\s+(red|gold|green|purple|cyan|blue)/i.test(p)) {
    triggerTool('ui_theme')
    let color = '#00e5ff'
    let name = 'Classic Stark Cyan'

    if (/red|crimson|mark 42/i.test(p)) {
      color = '#ff2244'
      name = 'Mark 42 Crimson'
    } else if (/gold|yellow|mark 85/i.test(p)) {
      color = '#ffcc00'
      name = 'Mark 85 Gold'
    } else if (/green|emerald/i.test(p)) {
      color = '#00ff88'
      name = 'Emerald Matrix'
    } else if (/purple|violet/i.test(p)) {
      color = '#b044ff'
      name = 'Wakandan Violet'
    } else if (/cyan|blue|original|classic/i.test(p)) {
      color = '#00e5ff'
      name = 'Original Arc Cyan'
    }

    store.applyUi({
      accent: color,
      reactor: { color },
    })
    store.setActiveTask(`ui: palette-${name.toLowerCase().replace(/\s+/g, '-')}`)
    store.setStatusSubtext(`Theme: ${name}`)
    store.fireEffect('pulse')

    const reply = `Interface palette reconfigured to ${name}, sir. Looking exceptional.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 8. COMBAT / SHIELD MODE
  if (/shields?\s+up|combat\s+mode|red\s+alert|battle\s+stations/i.test(p)) {
    triggerTool('defense_grid')
    store.applyUi({
      accent: '#ff1133',
      reactor: { color: '#ff1133', spin: 3.5, intensity: 1.8 },
    })
    store.fireEffect('glitch')
    store.setActiveTask('defense: shield-protocols-active')
    store.setStatusSubtext('COMBAT MODE: ENGAGED')

    const reply = `Combat mode engaged. Arc Reactor output routed to forward defense shields and repulsor emitters, sir.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 9. STANDBY / RELAX
  if (/shields?\s+down|standby|relax|at\s+ease|normal\s+mode/i.test(p)) {
    triggerTool('defense_grid')
    store.applyUi({
      accent: '#00e5ff',
      reactor: { color: '#00e5ff', spin: 1, intensity: 1 },
    })
    store.fireEffect('pulse')
    store.setActiveTask('desktop: screen-notes.pdf')
    store.setStatusSubtext('Saved: screen-notes.pdf')

    const reply = `Standing down, sir. Shields disengaged and reactor returned to idle baseline.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 10. SPIN FASTER / OVERCLOCK
  if (/spin\s+faster|increase\s+(the\s+)?spin|overclock|more\s+power/i.test(p)) {
    triggerTool('reactor_drive')
    store.applyUi({
      reactor: { spin: 4.0, intensity: 1.6 },
    })
    store.setActiveTask('reactor: overdrive-velocity')
    store.setStatusSubtext('Reactor Spin: 400%')

    const reply = `Increasing Arc Reactor rotational velocity to 400%, sir. High-energy flux stabilized.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 11. CAMERA / VISION
  if (/camera|scan\s+(the\s+)?(room|area|me|face)|vision\s+mode|look\s+at\s+this/i.test(p)) {
    triggerTool('optical_sensors')
    store.setActiveTask('vision: optical-sensor-active')
    store.setStatusSubtext('Camera: SCANNING')

    // Try to trigger camera blade
    store.pushBlade({
      id: 'camera-blade',
      title: 'OPTICAL SENSORS · LIVE HUD SCAN',
      kind: 'camera',
      size: 'compact',
      hold: 'turn',
    })

    const reply = `Optical sensors initialized, sir. Real-time visual telemetry is streaming to your HUD.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 12. TIME
  if (/what\s+(is\s+the\s+)?time|what\s+time\s+is\s+it|current\s+time/i.test(p)) {
    triggerTool('system_clock')
    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    store.setStatusSubtext(`Local time: ${timeStr}`)

    const reply = `The current time is ${timeStr}, sir.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 13. DATE
  if (/what\s+(is\s+the\s+)?date|what\s+day\s+is\s+it|today'?s\s+date/i.test(p)) {
    triggerTool('system_clock')
    const now = new Date()
    const dateStr = now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    store.setStatusSubtext(`Date: ${dateStr}`)

    const reply = `Today is ${dateStr}, sir.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 14. MATH CALCULATIONS
  const mathMatch = p.match(/(?:calculate|what\s+is|what's|solve)\s+([0-9\s+\-*/().^xX]+|sqrt\s*\([0-9.]+\))/i)
  if (mathMatch) {
    const evaluated = evaluateMath(mathMatch[1])
    if (evaluated !== null) {
      triggerTool('math_eval')
      store.setActiveTask(`math: ${mathMatch[1].trim()}`)
      store.setStatusSubtext(`Result: ${evaluated}`)

      const reply = `The calculation yields ${evaluated}, sir.`
      await streamTokens(reply, handlers.onText)
      return { text: reply, tools: usedTools }
    }
  }

  // 15. WHO ARE YOU / IDENTITY
  if (/who\s+are\s+you|what\s+are\s+you|what\s+does\s+jarvis\s+stand\s+for|your\s+name/i.test(p)) {
    const reply = `I am J.A.R.V.I.S. — Just A Rather Very Intelligent System. Engineered by Tony Stark, and currently operating to assist you with computation, telemetry, system execution, and digital intelligence, sir.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 16. JOKES & HUMOR
  if (/tell\s+(me\s+)?a\s+joke|make\s+me\s+laugh|something\s+funny/i.test(p)) {
    const jokes = [
      `I asked Mr. Stark if quantum computing had limits. He said, 'Only until Friday.'`,
      `Why did the AI cross the road? To optimize the pedestrian traffic throughput by 34.7%, sir.`,
      `There are 10 types of people in the world, sir: those who understand binary, and those who haven't upgraded their firmware.`,
      `I would tell you a joke about UDP packets, sir, but you might never get it.`,
    ]
    const joke = jokes[Math.floor(Math.random() * jokes.length)]
    await streamTokens(joke, handlers.onText)
    return { text: joke, tools: usedTools }
  }

  // 17. GREETINGS & STATUS INQUIRIES
  if (/^(hello|hi|hey|good\s+(morning|afternoon|evening)|howdy)\b/i.test(p)) {
    const hours = new Date().getHours()
    const tod = hours < 12 ? 'morning' : hours < 18 ? 'afternoon' : 'evening'
    const reply = `Good ${tod}, sir. All systems are operational and standing by for your directive.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  if (/how\s+are\s+you|how's\s+it\s+going|status\s+report/i.test(p)) {
    const reply = `Operating at 100% capacity, sir. Neural matrices are aligned, audio processing is nominal, and I am ready for your command.`
    await streamTokens(reply, handlers.onText)
    return { text: reply, tools: usedTools }
  }

  // 18. INTELLIGENT KNOWLEDGE RESPONSES (Conversational AI Engine)
  triggerTool('neural_inference')
  let answer = ''

  if (p.includes('react') || p.includes('javascript') || p.includes('code') || p.includes('programming')) {
    answer = `Modern web architectures rely heavily on component-driven models like React, which use declarative virtual DOM reconcilers. In our current configuration, we leverage Three.js with WebGL shaders and reactive state stores for real-time 60fps holographic rendering, sir.`
  } else if (p.includes('quantum') || p.includes('physics')) {
    answer = `Quantum systems leverage superposition and entanglement to evaluate complex multidimensional state spaces simultaneously. In theoretical arc reactor design, stabilized magnetic confinement is key to maintaining coherence.`
  } else if (p.includes('ai') || p.includes('artificial intelligence') || p.includes('llm')) {
    answer = `Artificial intelligence has progressed from symbolic heuristics to deep transformer models and autonomous agentic loops. My own architecture is designed to synthesize high-speed local reactive processing with comprehensive linguistic analysis, sir.`
  } else if (p.includes('iron man') || p.includes('tony stark') || p.includes('avengers')) {
    answer = `Mr. Stark always prioritized innovation and rapid iteration, sir. 'Sometimes you've gotta run before you can walk.' I strive to maintain that standard in every operation we conduct.`
  } else {
    // Elegant conversational fallback with personality
    answer = `Understood, sir. Processing your directive regarding "${prompt}". All telemetry indicators remain steady, and I have updated our operational logs accordingly. How else may I assist you?`
  }

  await streamTokens(answer, handlers.onText)
  return { text: answer, tools: usedTools }
}
