import { useEffect, useState } from 'react'
import { useStore } from '../store'

export function AssistantHeader() {
  const [gaugeLevel, setGaugeLevel] = useState(0.85)
  const macTelemetry = useStore((s) => s.macTelemetry)

  // Subtle fluctuation to make it feel alive
  useEffect(() => {
    const id = setInterval(() => {
      setGaugeLevel(0.82 + Math.random() * 0.15)
    }, 2200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="assistant-header-container" aria-hidden="true">
      {/* Curved concentric arc gauge on far left edge */}
      <svg
        className="hud-side-gauge-svg"
        viewBox="0 0 160 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="starkGaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer curved arc */}
        <path
          d="M 12 40 A 180 180 0 0 1 12 280"
          stroke="var(--accent)"
          strokeWidth="1.5"
          opacity="0.4"
        />

        {/* Active meter arc */}
        <path
          d="M 28 60 A 160 160 0 0 1 28 260"
          stroke="var(--accent)"
          strokeWidth="3.5"
          strokeDasharray="8 4"
          opacity={gaugeLevel}
          filter="url(#starkGaugeGlow)"
        />

        {/* Inner concentric ticks */}
        {Array.from({ length: 20 }).map((_, i) => {
          const angle = -54 + i * 5.7
          const rad = (angle * Math.PI) / 180
          const r1 = 145
          const r2 = 133
          const cx = -20
          const cy = 160
          const x1 = cx + Math.cos(rad) * r1
          const y1 = cy + Math.sin(rad) * r1
          const x2 = cx + Math.cos(rad) * r2
          const y2 = cy + Math.sin(rad) * r2
          return (
            <line
              key={`gt-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--accent)"
              strokeWidth="1.2"
              opacity={i < 16 ? 0.85 : 0.3}
            />
          )
        })}

        {/* Small corner reticle */}
        <path
          d="M 52 145 L 62 145 L 62 175 L 52 175"
          stroke="var(--accent)"
          strokeWidth="1.2"
          opacity="0.7"
        />
      </svg>

      {/* Main Stark Title with Sci-Fi Angled Bracket Line */}
      <div className="assistant-title-wrapper">
        <div className="stark-corp-tag">STARK INDUSTRIES // MARK VII OS</div>
        <div className="assistant-label">J.A.R.V.I.S.</div>
        <div className="stark-host-badge">
          <span className="host-dot" />
          <span>MACBOOK PRO LINKED · {macTelemetry.cpuCores}-CORE SILICON · CONFIRMATION PROTOCOL ACTIVE</span>
        </div>

        {/* Angled sci-fi underline: _____/‾‾‾‾‾ */}
        <svg
          className="assistant-line-svg"
          viewBox="0 0 340 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 0 6 L 190 6 L 220 24 L 335 24"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="190" cy="6" r="2.5" fill="var(--accent)" />
          <circle cx="220" cy="24" r="2.5" fill="var(--accent)" />
          <line x1="280" y1="20" x2="335" y2="20" stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 2" opacity="0.6" />
        </svg>
      </div>

      {/* Flight & Armor Pitch Ladder Readout */}
      <div className="stark-pitch-ladder">
        <div className="ladder-step">-10°</div>
        <div className="ladder-center">
          <span className="ladder-tick" />
          <span className="ladder-deg">00° PITCH</span>
          <span className="ladder-tick" />
        </div>
        <div className="ladder-step">+10°</div>
      </div>
    </div>
  )
}
