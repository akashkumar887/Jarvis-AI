import { useStore } from '../store'

interface HardwareTelemetryProps {
  level: number
}

export function HardwareTelemetry({ level }: HardwareTelemetryProps) {
  const telemetry = useStore((s) => s.macTelemetry)

  // Parse battery percentage number
  const battMatch = telemetry.batteryPct.match(/(\d+)/)
  const battNum = battMatch ? parseInt(battMatch[1], 10) : 100

  return (
    <aside className="stark-rail stark-rail-right" aria-label="MacBook Hardware Telemetry">
      <div className="stark-rail-header">
        <span className="stark-rail-glyph">⬡</span>
        <span className="stark-rail-title">HARDWARE TELEMETRY</span>
      </div>

      {/* Battery State */}
      <div className="stark-telemetry-card">
        <div className="telemetry-card-label">
          <span>MAC POWER RESERVE</span>
          <span className="telemetry-val-highlight">{telemetry.batteryPct}</span>
        </div>
        <div className="stark-bar-container">
          <div
            className={`stark-bar-fill ${battNum < 20 ? 'danger' : battNum < 50 ? 'warn' : 'nominal'}`}
            style={{ width: `${Math.min(100, Math.max(5, battNum))}%` }}
          />
        </div>
        <div className="telemetry-sub-meta">
          <span>SOURCE: {telemetry.powerSource}</span>
          <span>{telemetry.isCharging ? '⚡ CHARGING' : 'BATTERY'}</span>
        </div>
      </div>

      {/* Storage Disk */}
      <div className="stark-telemetry-card">
        <div className="telemetry-card-label">
          <span>STORAGE DRIVE (/)</span>
          <span className="telemetry-val-mono">{telemetry.diskFree} FREE</span>
        </div>
        <div className="stark-bar-container">
          <div className="stark-bar-fill nominal" style={{ width: '28%' }} />
        </div>
        <div className="telemetry-sub-meta">
          <span>CAPACITY: {telemetry.diskTotal}</span>
          <span>APFS HIGH SPEED</span>
        </div>
      </div>

      {/* Audio Output Volume */}
      <div className="stark-telemetry-card">
        <div className="telemetry-card-label">
          <span>SYSTEM AUDIO VOLUME</span>
          <span className="telemetry-val-highlight">{telemetry.volume}%</span>
        </div>
        <div className="stark-bar-container">
          <div
            className="stark-bar-fill nominal"
            style={{ width: `${Math.min(100, Math.max(0, telemetry.volume))}%` }}
          />
        </div>
        <div className="telemetry-sub-meta">
          <span>DSP ENGINE: ONLINE</span>
          <span>CORE AUDIO</span>
        </div>
      </div>

      {/* Arc Reactor & Repulsor Output */}
      <div className="stark-telemetry-card stark-reactor-card">
        <div className="telemetry-card-label">
          <span>ARC REACTOR TELEMETRY</span>
          <span className="telemetry-val-hot">3.2 GJ/s</span>
        </div>
        <div className="reactor-telemetry-grid">
          <div className="r-cell">
            <span className="r-label">CORE STABILITY</span>
            <span className="r-val">99.8%</span>
          </div>
          <div className="r-cell">
            <span className="r-label">REPULSORS</span>
            <span className="r-val">CHARGED</span>
          </div>
          <div className="r-cell">
            <span className="r-label">FLIGHT GYRO</span>
            <span className="r-val">ACTIVE</span>
          </div>
          <div className="r-cell">
            <span className="r-label">SHIELD MATRIX</span>
            <span className="r-val">NOMINAL</span>
          </div>
        </div>
      </div>

      {/* Signal & Sonic Input */}
      <div className="stark-telemetry-card">
        <div className="telemetry-card-label">
          <span>ACOUSTIC SIGNAL CAPTURE</span>
          <span className="telemetry-val-mono">{(level * 100).toFixed(0).padStart(3, '0')}%</span>
        </div>
        <div className="stark-signal-spectrum">
          {Array.from({ length: 16 }).map((_, i) => {
            const h = Math.min(100, Math.max(8, (level * 130 * ((i % 5) + 1)) / 3))
            return (
              <span
                key={`sig-${i}`}
                className="spectrum-band"
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>
        <div className="telemetry-sub-meta">
          <span>AUDIO CAPTURE</span>
          <span>{level > 0.05 ? 'VOICE DETECTED' : 'STANDBY'}</span>
        </div>
      </div>
    </aside>
  )
}
