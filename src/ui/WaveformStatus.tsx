import { useEffect, useState } from 'react'
import { useStore, type Phase } from '../store'

interface WaveformStatusProps {
  phase: Phase
  level: number
}

const statusDisplay: Record<Phase, string> = {
  offline: 'STANDBY',
  boot: 'INITIALISING',
  dormant: 'STANDBY',
  waking: 'ONLINE',
  listening: 'LISTENING',
  thinking: 'PROCESSING',
  tooling: 'EXECUTING TASK',
  speaking: 'RESPONDING',
}

const NUM_BARS = 24

export function WaveformStatus({ phase, level }: WaveformStatusProps) {
  const statusSubtext = useStore((s) => s.statusSubtext)
  const timerSeconds = useStore((s) => s.timerSeconds)
  const [sineTick, setSineTick] = useState(0)

  // Gentle wave oscillation when idle
  useEffect(() => {
    let animId: number
    const step = (t: number) => {
      setSineTick(t * 0.0035)
      animId = requestAnimationFrame(step)
    }
    animId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animId)
  }, [])

  const isActive = phase === 'listening' || phase === 'speaking' || phase === 'thinking' || phase === 'tooling'

  return (
    <div className="hud-waveform-status-section" aria-live="polite">
      {/* Waveform flanked by brackets and dotted lines: .... ( |||||||||| ) .... */}
      <div className="waveform-row">
        {/* Left dotted tail */}
        <span className="waveform-dots" aria-hidden="true">
          <span>·</span>
          <span>·</span>
          <span>·</span>
          <span>·</span>
        </span>

        {/* Left curved bracket */}
        <span className="waveform-bracket" aria-hidden="true">
          (
        </span>

        {/* Dynamic audio waveform bars */}
        <div className="waveform-bars">
          {Array.from({ length: NUM_BARS }).map((_, i) => {
            // Distance from center (0 at middle, 1 at edge)
            const distFromCenter = Math.abs(i - (NUM_BARS - 1) / 2) / ((NUM_BARS - 1) / 2)
            const bellCurve = Math.max(0.12, 1 - distFromCenter * 0.85)

            let heightPercent = 14
            if (isActive) {
              // React to audio level with frequency variation
              const freqJitter = Math.sin(sineTick * 3.5 + i * 0.7) * 0.35 + 0.65
              heightPercent = Math.min(100, Math.max(12, (level * 80 + 15) * bellCurve * freqJitter))
            } else {
              // Idle gentle breathing sine wave
              const idleSine = Math.sin(sineTick * 1.5 + i * 0.4) * 0.5 + 0.5
              heightPercent = Math.max(10, 22 * bellCurve * (0.6 + idleSine * 0.4))
            }

            return (
              <span
                key={`bar-${i}`}
                className="waveform-bar"
                style={{
                  height: `${heightPercent}%`,
                  opacity: 0.4 + (heightPercent / 100) * 0.6,
                }}
              />
            )
          })}
        </div>

        {/* Right curved bracket */}
        <span className="waveform-bracket" aria-hidden="true">
          )
        </span>

        {/* Right dotted tail */}
        <span className="waveform-dots" aria-hidden="true">
          <span>·</span>
          <span>·</span>
          <span>·</span>
          <span>·</span>
        </span>
      </div>

      {/* Main Status Text (e.g. RESPONDING, LISTENING, STANDBY) */}
      <div className="waveform-status-label">{statusDisplay[phase]}</div>

      {/* Subtext info (e.g. Saved: screen-notes.pdf) */}
      <div className="waveform-status-subtext">
        {timerSeconds !== null
          ? `Timer active: ${Math.floor(timerSeconds / 60)}m ${timerSeconds % 60}s remaining`
          : statusSubtext || 'Saved: screen-notes.pdf'}
      </div>
    </div>
  )
}
