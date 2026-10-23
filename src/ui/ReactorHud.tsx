import { useEffect, useState } from 'react'
import type { Phase } from '../store'

interface ReactorHudProps {
  level?: number
  phase: Phase
}

export function ReactorHud({ phase }: ReactorHudProps) {
  const [seconds, setSeconds] = useState(78)

  // Live timer tick (1Hz tick)
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => (s + 1) % 3600)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const isWorking = phase === 'thinking' || phase === 'speaking' || phase === 'tooling'

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className={`reactor-hud-container ${isWorking ? 'hud-working' : ''}`} aria-hidden="true">
      {/* Outer ambient dotted grid matrices on left and right */}
      <div className="telemetry-dots telemetry-dots-left">
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={`dl-${i}`} className="t-dot" style={{ opacity: 0.15 + (i % 5) * 0.14 }} />
        ))}
      </div>
      <div className="telemetry-dots telemetry-dots-right">
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={`dr-${i}`} className="t-dot" style={{ opacity: 0.15 + (i % 5) * 0.14 }} />
        ))}
      </div>

      <svg
        className="reactor-hud-svg"
        viewBox="0 0 640 640"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="starkCyanGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="intenseCoreGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="arcCoreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#ffc043" stopOpacity="0.65" />
            <stop offset="80%" stopColor="#ff8800" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f5a623" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Center group translated to 320, 320 */}
        <g transform="translate(320, 320)">
          {/* Vertical Top Axis Antenna / Beacon */}
          <line
            x1="0"
            y1="-200"
            x2="0"
            y2="-290"
            stroke="var(--accent)"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <circle cx="0" cy="-240" r="3.5" fill="var(--accent)" filter="url(#starkCyanGlow)" />
          <circle
            cx="0"
            cy="-290"
            r="5"
            fill="var(--accent)"
            filter="url(#intenseCoreGlow)"
            className="hud-beacon-pulse"
          />
          <circle
            cx="0"
            cy="-290"
            r="10"
            stroke="var(--accent)"
            strokeWidth="1"
            opacity="0.45"
            className="hud-beacon-ring"
          />

          {/* Horizontal Crosshairs with Alignment Marks */}
          <line
            x1="-300"
            y1="0"
            x2="-210"
            y2="0"
            stroke="var(--accent)"
            strokeWidth="1"
            opacity="0.6"
            strokeDasharray="10 5"
          />
          <line
            x1="210"
            y1="0"
            x2="300"
            y2="0"
            stroke="var(--accent)"
            strokeWidth="1"
            opacity="0.6"
            strokeDasharray="10 5"
          />

          {/* Diagonal Corner Reticles (Tony Stark Flight HUD style) */}
          <path d="M -180 -180 L -150 -180 L -180 -150 Z" fill="var(--accent)" opacity="0.3" />
          <path d="M 180 -180 L 150 -180 L 180 -150 Z" fill="var(--accent)" opacity="0.3" />
          <path d="M -180 180 L -150 180 L -180 150 Z" fill="var(--accent)" opacity="0.3" />
          <path d="M 180 180 L 150 180 L 180 150 Z" fill="var(--accent)" opacity="0.3" />

          {/* OUTER ROTATING RING 1 (Clockwise) */}
          <g className="hud-ring-outer">
            <circle
              r="245"
              stroke="var(--accent)"
              strokeWidth="1"
              strokeDasharray="12 18 4 18"
              opacity="0.5"
            />
            <circle
              r="235"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeDasharray="60 30 15 30 90 40"
              opacity="0.75"
              filter="url(#starkCyanGlow)"
            />
            {/* Degree ticks at 0, 90, 180, 270 */}
            {[0, 90, 180, 270].map((deg) => (
              <line
                key={`otick-${deg}`}
                x1="0"
                y1="-235"
                x2="0"
                y2="-248"
                stroke="var(--accent)"
                strokeWidth="2"
                transform={`rotate(${deg})`}
              />
            ))}
          </g>

          {/* MIDDLE COUNTER-ROTATING RING 2 (Counter-Clockwise) */}
          <g className="hud-ring-mid">
            <circle
              r="195"
              stroke="var(--accent)"
              strokeWidth="1.2"
              strokeDasharray="35 15 5 15"
              opacity="0.6"
            />
            <circle
              r="180"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray="120 40 80 40"
              opacity="0.8"
            />
            {/* 12 Concentric Coil Nodes */}
            {Array.from({ length: 12 }).map((_, i) => {
              const deg = i * 30
              return (
                <rect
                  key={`node-${deg}`}
                  x="-3"
                  y="-182"
                  width="6"
                  height="8"
                  fill="var(--accent)"
                  opacity="0.7"
                  transform={`rotate(${deg})`}
                />
              )
            })}
          </g>

          {/* INNER HEXAGONAL COIL RING (Clockwise) */}
          <g className="hud-ring-inner">
            <circle
              r="140"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeDasharray="6 8"
              opacity="0.75"
              filter="url(#starkCyanGlow)"
            />
            {/* 6 Arc segments simulating energy coil separators */}
            {Array.from({ length: 6 }).map((_, i) => {
              const deg = i * 60
              return (
                <line
                  key={`coil-${deg}`}
                  x1="0"
                  y1="-110"
                  x2="0"
                  y2="-138"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  opacity="0.85"
                  transform={`rotate(${deg})`}
                />
              )
            })}
          </g>

          {/* CENTRAL ARC REACTOR GLOWING CORE */}
          <circle
            r="105"
            fill="url(#arcCoreGrad)"
            opacity="0.85"
            filter="url(#intenseCoreGlow)"
          />
          <circle
            r="105"
            stroke="var(--accent)"
            strokeWidth="2"
            opacity="0.85"
            strokeDasharray="20 10"
          />
          <circle
            r="80"
            stroke="var(--accent)"
            strokeWidth="1.5"
            opacity="0.9"
            filter="url(#starkCyanGlow)"
          />
          <circle
            r="55"
            stroke="#ffb703"
            strokeWidth="1.5"
            opacity="0.8"
            strokeDasharray="8 6"
          />

          {/* Central Holographic Iron Man HUD Readout */}
          <g className="reactor-center-text">
            <text
              y="-18"
              textAnchor="middle"
              fill="var(--accent)"
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.28em"
              opacity="0.95"
            >
              MARK VII // ARC
            </text>
            <text
              y="2"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="14"
              fontWeight="800"
              letterSpacing="0.14em"
              filter="url(#starkCyanGlow)"
            >
              3.2 GJ/s
            </text>
            <text
              y="20"
              textAnchor="middle"
              fill="var(--accent)"
              fontSize="9"
              fontWeight="600"
              letterSpacing="0.22em"
              opacity="0.8"
            >
              {formatTime(seconds)}
            </text>
          </g>
        </g>
      </svg>
    </div>
  )
}
