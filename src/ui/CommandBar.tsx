
import { useState, type FormEvent } from 'react'
import type { Phase } from '../store'

interface CommandBarProps {
  onSubmit: (text: string) => void
  onToggleMic?: () => void
  phase?: Phase
  level?: number
  disabled?: boolean
}

const QUICK_ACTIONS = [
  { label: '🎬 YouTube on Chrome', cmd: 'Open YouTube on Chrome' },
  { label: '💬 WhatsApp Message', cmd: 'Send message on WhatsApp' },
  { label: '✉️ Make & Send Email', cmd: 'Make email to contact@starkindustries.com with subject Greetings saying All systems are online and operational' },
  { label: '🌙 Dark Mode', cmd: 'Toggle Dark Mode' },
  { label: '🔒 Lock Mac', cmd: 'Lock my MacBook' },
  { label: '📸 Screenshot', cmd: 'Take a screenshot' },
  { label: '📊 Top Processes', cmd: 'Top processes' },
  { label: '🗑️ Empty Trash', cmd: 'Empty trash' },
  { label: '📶 Wi-Fi Status', cmd: 'Check Wi-Fi and IP' },
  { label: '🎵 Open Spotify', cmd: 'Open Spotify' },
  { label: '⚡ Mac Diagnostics', cmd: 'System diagnostics report' },
  { label: '📋 My Directives', cmd: 'List my directives' },
  { label: '🔊 Volume 80%', cmd: 'Set volume to 80' },
]

export function CommandBar({ onSubmit, onToggleMic, phase = 'dormant', disabled }: CommandBarProps) {
  const [input, setInput] = useState('')

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || disabled) return
    onSubmit(input.trim())
    setInput('')
  }

  const handleQuickClick = (cmd: string) => {
    if (disabled) return
    onSubmit(cmd)
  }

  const isListening = phase === 'listening'
  const isSpeaking = phase === 'speaking'

  return (
    <div className="clean-command-dock" role="region" aria-label="J.A.R.V.I.S. Command Center">
      {/* Quick Action Chips */}
      <div className="clean-quick-chips">
        {QUICK_ACTIONS.map((item) => (
          <button
            key={item.label}
            type="button"
            className="clean-chip-btn"
            onClick={() => handleQuickClick(item.cmd)}
            disabled={disabled}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Unified Input Pill */}
      <div className={`clean-command-pill ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}>
        {/* Integrated Holographic Mic Button */}
        <button
          type="button"
          className={`clean-mic-btn ${isListening ? 'active-listen' : ''} ${isSpeaking ? 'active-speak' : ''}`}
          onClick={() => onToggleMic?.()}
          title={isListening ? 'Click to stop listening' : 'Click to talk with J.A.R.V.I.S.'}
          aria-label="Toggle Microphone"
        >
          {isListening ? (
            <span
              className="mic-pulse-wave"
              style={{ transform: 'scale(calc(1 + var(--mic-level, 0) * 0.4))' }}
            />
          ) : null}
          <svg className="mic-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </button>

        {/* Command Text Input Form */}
        <form onSubmit={handleFormSubmit} className="clean-input-form">
          <input
            type="text"
            className="clean-text-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              disabled
                ? 'Processing directive...'
                : isListening
                ? 'Listening to your voice... (or type here)'
                : 'Ask J.A.R.V.I.S. or enter command (e.g. "open spotify", "volume 70%")...'
            }
            disabled={disabled}
            autoFocus
          />
          <button
            type="submit"
            className="clean-send-btn"
            disabled={disabled || !input.trim()}
            title="Transmit command"
          >
            <span className="send-text">TRANSMIT</span>
            <span className="send-arrow">➤</span>
          </button>
        </form>
      </div>
    </div>
  )
}
