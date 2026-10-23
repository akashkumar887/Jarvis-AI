import { useState } from 'react'
import { useStore } from '../store'
import * as sfx from '../lib/sfx'

interface MacControlPanelProps {
  onRequestAction: (cmd: string) => void
}

export function MacControlPanel({ onRequestAction }: MacControlPanelProps) {
  const strict = useStore((s) => s.strictConfirmation)
  const setStrict = useStore((s) => s.setStrictConfirmation)
  const macTelemetry = useStore((s) => s.macTelemetry)
  const [showPermissionsInfo, setShowPermissionsInfo] = useState(false)

  const handleActionClick = (cmd: string) => {
    sfx.play('tool')
    onRequestAction(cmd)
  }

  return (
    <aside className="stark-rail stark-rail-left" aria-label="MacBook Control & Permissions">
      <div className="stark-rail-header">
        <span className="stark-rail-glyph">⬡</span>
        <span className="stark-rail-title">MACBOOK DIRECT CONTROL</span>
      </div>

      {/* Host connection status */}
      <div className="stark-connection-chip">
        <span className="stark-chip-beacon" />
        <div className="stark-chip-meta">
          <div className="stark-chip-host">APPLE MACBOOK PRO</div>
          <div className="stark-chip-details">
            {macTelemetry.cpuCores}-CORE SILICON · {macTelemetry.osVersion}
          </div>
        </div>
      </div>

      {/* Strict Permission Protocol Gate */}
      <div className="stark-protocol-gate">
        <div className="gate-title-row">
          <span className="gate-title">STRICT SAFETY PROTOCOL</span>
          <span className={`gate-status-pill ${strict ? 'active' : 'warn'}`}>
            {strict ? 'ENFORCED' : 'MANUAL'}
          </span>
        </div>
        <div className="gate-description">
          {strict
            ? 'J.A.R.V.I.S. will strictly ask for your confirmation before executing any directive on your Mac.'
            : 'Immediate autonomous execution enabled (Caution: high autonomy).'}
        </div>
        <button
          type="button"
          className="stark-gate-toggle"
          onClick={() => {
            sfx.play('tool')
            setStrict(!strict)
          }}
        >
          {strict ? '🔒 CONFIRMATION REQUIRED: ON' : '⚠️ DIRECT EXECUTION: ACTIVE'}
        </button>
      </div>

      {/* Permissions Matrix */}
      <div className="stark-perm-section">
        <div className="stark-section-title">
          <span>SUBSYSTEM PRIVILEGES</span>
          <button
            type="button"
            className="stark-info-link"
            onClick={() => setShowPermissionsInfo((v) => !v)}
          >
            {showPermissionsInfo ? 'HIDE GUIDE' : 'MAC GUIDE'}
          </button>
        </div>

        {showPermissionsInfo && (
          <div className="stark-perm-guide">
            <div className="guide-heading">macOS Permissions Setup:</div>
            <div className="guide-body">
              1. Open <b>System Settings → Privacy & Security</b><br />
              2. Select <b>Automation</b> → Ensure <b>Terminal / Node</b> has permission for <b>System Events</b>, <b>Spotify</b>, and <b>Music</b>.<br />
              3. Select <b>Accessibility</b> → Allow <b>Terminal</b> or <b>Jarvis</b> if prompted.<br />
              All control scripts run safely on localhost via AppleScript and system daemons.
            </div>
          </div>
        )}

        <div className="stark-perm-list">
          <div className="stark-perm-item">
            <span className="perm-dot granted" />
            <span className="perm-name">macOS AppleScript Automation</span>
            <span className="perm-badge">AUTHORIZED</span>
          </div>

          <div className="stark-perm-item">
            <span className="perm-dot granted" />
            <span className="perm-name">Application Launcher</span>
            <span className="perm-badge gated">GATED</span>
          </div>

          <div className="stark-perm-item">
            <span className="perm-dot granted" />
            <span className="perm-name">Audio & Media Core</span>
            <span className="perm-badge gated">GATED</span>
          </div>

          <div className="stark-perm-item">
            <span className="perm-dot granted" />
            <span className="perm-name">Terminal & Shell Engine</span>
            <span className="perm-badge gated">GATED</span>
          </div>

          <div className="stark-perm-item">
            <span className="perm-dot granted" />
            <span className="perm-name">Directives Database</span>
            <span className="perm-badge gated">GATED</span>
          </div>
        </div>
      </div>

      {/* Quick Verified Directives */}
      <div className="stark-quick-section">
        <div className="stark-section-title">CONTROL DIRECTIVES</div>
        <div className="stark-quick-buttons">
          <button
            type="button"
            className="stark-quick-btn"
            onClick={() => handleActionClick('Open Spotify')}
          >
            <span className="q-icon">🎵</span>
            <span>Launch Spotify</span>
          </button>

          <button
            type="button"
            className="stark-quick-btn"
            onClick={() => handleActionClick('Open Google Chrome')}
          >
            <span className="q-icon">🌐</span>
            <span>Launch Chrome</span>
          </button>

          <button
            type="button"
            className="stark-quick-btn"
            onClick={() => handleActionClick('Set volume to 50')}
          >
            <span className="q-icon">🔊</span>
            <span>Set Volume 50%</span>
          </button>

          <button
            type="button"
            className="stark-quick-btn"
            onClick={() => handleActionClick('System diagnostics report')}
          >
            <span className="q-icon">⚡</span>
            <span>Diagnostics Sweep</span>
          </button>

          <button
            type="button"
            className="stark-quick-btn"
            onClick={() => handleActionClick('Add a task to calibrate the Arc Reactor')}
          >
            <span className="q-icon">📝</span>
            <span>Log Directive</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
