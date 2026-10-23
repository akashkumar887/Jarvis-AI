import type { Phase } from '../store'

interface MicButtonProps {
  phase: Phase
  onToggleMic: () => void
}

export function MicButton({ phase, onToggleMic }: MicButtonProps) {
  const isListening = phase === 'listening'
  const isSpeaking = phase === 'speaking'

  return (
    <div className="hud-mic-button-wrapper">
      <button
        type="button"
        className={`hud-mic-btn ${isListening ? 'active-listening' : ''} ${isSpeaking ? 'active-speaking' : ''}`}
        onClick={onToggleMic}
        title={
          isListening
            ? 'Listening... Click to pause'
            : isSpeaking
              ? 'Speaking... Click to interrupt'
              : 'Click to speak to JARVIS'
        }
        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
      >
        {/* Pulsing outer aura ring */}
        <span className="mic-aura-ring" />
        <span className="mic-aura-ring second" />

        {/* Microphone SVG icon */}
        <svg
          className="hud-mic-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
      </button>
    </div>
  )
}
