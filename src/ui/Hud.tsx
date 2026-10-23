import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useStore, accentFor, type Phase } from '../store'
import { BladeSweep, Blades } from './Blades'
import { Effects } from './Effects'
import { Pointer } from './Pointer'
import { GestureGuide } from './GestureGuide'
import { ReactorHud } from './ReactorHud'
import { CommandBar } from './CommandBar'
import { cycleVoice, createSpeaker } from '../lib/tts'

const statusText: Record<Phase, string> = {
  offline: 'OFFLINE',
  boot: 'INITIALISING',
  dormant: 'ONLINE // READY',
  waking: 'ONLINE',
  listening: 'LISTENING...',
  thinking: 'PROCESSING...',
  tooling: 'EXECUTING TASK...',
  speaking: 'RESPONDING...',
}

function Corner({ at }: { at: 'tl' | 'tr' | 'bl' | 'br' }) {
  return <div className={`corner corner-${at}`} />
}

/* ------------------------------------------------------------------ decode */

const GLYPHS = '/\\|<>[]{}=+*#%&$0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const GHOST = 18
const FRAME_MS = 42
const MIN_RATE = 110
const MAX_LAG_MS = 420

function scramble(s: string, seed: number) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === ' ' || c === '\n' || c === '\t') {
      out += c
      continue
    }
    out += GLYPHS[(seed * 7919 + i * 104729 + c.charCodeAt(0)) % GLYPHS.length]
  }
  return out
}

function DecodeText({ text }: { text: string }) {
  const reduced = useReducedMotion()
  const settled = useRef(0)
  const raf = useRef(0)
  const latest = useRef(text)
  const [tick, bump] = useState(0)

  useEffect(() => {
    latest.current = text

    if (reduced) {
      settled.current = text.length
      return
    }
    if (raf.current || settled.current >= text.length) return

    let prev = performance.now()
    let painted = 0

    const step = (now: number) => {
      const dt = Math.min(now - prev, 120) / 1000
      prev = now

      const target = latest.current.length
      const rate = Math.max(MIN_RATE, (target - settled.current) / (MAX_LAG_MS / 1000))
      settled.current = Math.min(target, settled.current + rate * dt)

      if (now - painted >= FRAME_MS) {
        painted = now
        bump((n) => n + 1)
      }

      if (settled.current < latest.current.length) {
        raf.current = requestAnimationFrame(step)
      } else {
        raf.current = 0
        bump((n) => n + 1)
      }
    }
    raf.current = requestAnimationFrame(step)
  }, [text, reduced])

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      raf.current = 0
    },
    [],
  )

  const n = Math.floor(settled.current)
  if (reduced || n >= text.length) return <>{text}</>

  return (
    <>
      {text.slice(0, n)}
      <span className="decode-ghost">{scramble(text.slice(n, n + GHOST), tick)}</span>
      <span className="decode-veil">{text.slice(n + GHOST)}</span>
    </>
  )
}

/* --------------------------------------------------------------------- hud */

interface HudProps {
  onTransmitText?: (text: string) => void
  onToggleMic?: () => void
}

export function Hud({ onTransmitText, onToggleMic }: HudProps = {}) {
  const phase = useStore((s) => s.phase)
  const caption = useStore((s) => s.caption)
  const turns = useStore((s) => s.turns)
  const activeTool = useStore((s) => s.activeTool)
  const error = useStore((s) => s.error)
  const voice = useStore((s) => s.voice)
  const bootNote = useStore((s) => s.bootNote)
  const gestures = useStore((s) => s.gestures)
  const looking = useStore((s) => s.looking)
  const ui = useStore((s) => s.ui)

  const [showConfig, setShowConfig] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [modelSelect, setModelSelect] = useState('gemini-3.8-flash')
  const [savedKey, setSavedKey] = useState<string | null>(() => localStorage.getItem('jarvis_gemini_key'))

  const colour = accentFor(phase, ui)

  useEffect(() => {
    const root = document.documentElement
    if (ui.background) root.style.setProperty('--bg', ui.background)
    else root.style.removeProperty('--bg')
  }, [ui.background])

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault()
    if (apiKeyInput.trim()) {
      localStorage.setItem('jarvis_gemini_key', apiKeyInput.trim())
      setSavedKey(apiKeyInput.trim())
      // Also notify bridge via asking
      onTransmitText?.(`configure gemini key ${apiKeyInput.trim()}`)
    }
    localStorage.setItem('jarvis_gemini_model', modelSelect)
    setShowConfig(false)
  }

  const handleCycleVoice = () => {
    const nextName = cycleVoice()
    useStore.getState().setVoice(nextName)
    const clean = nextName.replace(/\(.*?\)/g, '').trim()
    const spk = createSpeaker()
    spk.say(`Vocal matrix switched to ${clean}, sir.`)
    void spk.end()
  }

  return (
    <div className="hud clean-hud" style={{ ['--accent' as string]: colour }}>
      <BladeSweep />

      <Corner at="tl" />
      <Corner at="tr" />
      <Corner at="bl" />
      <Corner at="br" />

      {/* Center 3D Concentric Multi-Ring Reactor HUD */}
      <ReactorHud phase={phase} />

      {/* Sleek Minimalist Top Header */}
      <header className="clean-hud-top">
        <div className="clean-brand">
          <div className="clean-brand-row">
            <span className="clean-brand-mark">J.A.R.V.I.S.</span>
            <span className="clean-brand-tag">MARK VII</span>
          </div>
          <span className="clean-brand-sub">STARK INDUSTRIES // GEMINI LIVE</span>
        </div>

        <div className="clean-status-cluster">
          {/* Gemini AI Status Badge & Quick Config Button */}
          <button
            type="button"
            className="clean-voice-pill gemini-flash-pill"
            onClick={() => setShowConfig(true)}
            title="Click to configure Google Gemini 3.8 Flash & API Key"
          >
            <span className="voice-dot gemini-dot" />
            <span className="voice-label">GEMINI 3.8 FLASH</span>
          </button>

          <button
            type="button"
            className="clean-voice-pill voice-select-pill"
            onClick={handleCycleVoice}
            title={`Active Voice: ${voice || 'Natural British'}. Click to cycle voices (or press V)`}
          >
            <span className="voice-dot" />
            <span className="voice-label">VOICE: {voice ? voice.replace(/\(.*?\)/g, '').trim().toUpperCase() : 'ACTIVE'}</span>
          </button>

          <div className={`clean-status-pill phase-${phase}`}>
            <span className="dot" />
            <span className="status-text">
              {phase === 'boot' && bootNote ? bootNote : statusText[phase]}
            </span>
          </div>
        </div>
      </header>

      {/* Modal for Gemini 3.8 Flash Key & Configuration */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            className="clean-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfig(false)}
          >
            <motion.div
              className="clean-modal-card"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>⚡ GEMINI 3.8 FLASH NEURAL CORE</h3>
                <button type="button" className="modal-close" onClick={() => setShowConfig(false)}>✕</button>
              </div>
              <p className="modal-desc">
                Connect your Google Gemini Flash model for real-time conversation and automated macOS tasks execution.
              </p>
              <form onSubmit={handleSaveConfig} className="modal-form">
                <label className="modal-label">
                  Active Model:
                  <select
                    className="modal-select"
                    value={modelSelect}
                    onChange={(e) => setModelSelect(e.target.value)}
                  >
                    <option value="gemini-3.8-flash">Gemini 3.8 Flash (High Speed & Reasoning)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  </select>
                </label>

                <label className="modal-label">
                  Google Gemini API Key:
                  <input
                    type="password"
                    className="modal-input"
                    placeholder={savedKey ? '•••••••••••••••••••••••••• (Key Active)' : 'Paste API key from aistudio.google.com'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                  />
                </label>

                <div className="modal-actions">
                  <button type="submit" className="modal-save-btn">
                    SAVE & ACTIVATE
                  </button>
                  <button
                    type="button"
                    className="modal-cancel-btn"
                    onClick={() => setShowConfig(false)}
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active System Directive Execution Badge */}
      <AnimatePresence>
        {activeTool && (
          <motion.div
            className="tool-badge"
            initial={{ opacity: 0, x: '-50%', y: -10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: '-50%', y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: '-50%', y: -10, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <span className="tool-kicker">
              <span className="spinner" />
              EXECUTING
            </span>
            <span className="tool-name">{activeTool.replace(/[_-]/g, ' ')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Conversation Transcript Display */}
      {ui.chrome.transcript && turns.length > 0 && (
        <div className="clean-log-container">
          <AnimatePresence initial={false}>
            {turns.slice(-3).map((t) => (
              <motion.div
                key={t.id}
                className={`clean-log-card log-${t.role}`}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              >
                <div className="clean-log-header">
                  <span className="clean-log-badge">{t.role === 'user' ? 'YOU' : 'J.A.R.V.I.S.'}</span>
                </div>
                <div className="clean-log-body">
                  {t.role === 'jarvis' ? <DecodeText text={t.text} /> : t.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Live Voice Partial Caption */}
      <AnimatePresence>
        {caption && (
          <motion.div
            className="clean-live-caption"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <span className="caption-pulse" />
            <span className="caption-text">{caption}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Holographic Projection Blades (when projected) */}
      <Blades />

      {error && <div className="clean-error-banner">{error}</div>}

      {/* Clean Bottom Command Pill & Integrated Microphone */}
      <CommandBar
        onSubmit={(text: string) => onTransmitText?.(text)}
        onToggleMic={onToggleMic}
        phase={phase}
        disabled={phase === 'thinking'}
      />

      {/* Subtle Visual Effects */}
      <Effects />
      <Pointer />

      {(gestures || looking) && (
        <div className="hands-live">
          {looking ? `LOOKING — ${looking.toUpperCase()}` : 'CAMERA ON · G TO STOP'}
        </div>
      )}
      <GestureGuide live={gestures} />
    </div>
  )
}
