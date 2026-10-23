import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type PendingAction } from '../store'
import * as sfx from '../lib/sfx'

interface ConfirmationModalProps {
  action: PendingAction | null
  onConfirm: () => void
  onAbort: () => void
}

export function ConfirmationModal({ action, onConfirm, onAbort }: ConfirmationModalProps) {
  // Play alert sound when confirmation modal appears
  useEffect(() => {
    if (action) {
      sfx.play('wake')
    }
  }, [action])

  // Keyboard shortcuts: Enter = Confirm, Escape = Abort
  useEffect(() => {
    if (!action) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onAbort()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [action, onConfirm, onAbort])

  if (!action) return null

  return (
    <AnimatePresence>
      <div className="stark-modal-backdrop">
        <motion.div
          className="stark-confirmation-card"
          initial={{ opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        >
          {/* Tech Corner Brackets */}
          <div className="corner-bracket cb-tl" />
          <div className="corner-bracket cb-tr" />
          <div className="corner-bracket cb-bl" />
          <div className="corner-bracket cb-br" />

          {/* Stark Header Badge */}
          <div className="stark-modal-header">
            <div className="stark-warning-icon">
              <span className="pulse-beacon" />
              ⚠️
            </div>
            <div className="stark-header-text">
              <div className="stark-title">STARK INDUSTRIES SECURITY PROTOCOL</div>
              <div className="stark-subtitle">RESTRICTED SYSTEM DIRECTIVE // LEVEL 4 AUTHORIZATION REQUIRED</div>
            </div>
          </div>

          <div className="stark-divider" />

          {/* Prompt description */}
          <div className="stark-modal-body">
            <div className="stark-prompt-lead">
              Sir, I have prepared the following directive to execute on your <b>MacBook</b>:
            </div>

            <div className="stark-action-box">
              <div className="stark-action-header">
                <span className="stark-action-tag">DIRECTIVE</span>
                <span className="stark-action-title">{action.title}</span>
              </div>
              <div className="stark-action-desc">{action.description}</div>

              <div className="stark-param-grid">
                <div className="stark-param-row">
                  <span className="param-k">TARGET SUBSYSTEM:</span>
                  <span className="param-v">{action.permission || 'macOS System Automation'}</span>
                </div>
                <div className="stark-param-row">
                  <span className="param-k">TARGET ACTION:</span>
                  <span className="param-v mono">{action.tool}</span>
                </div>
                {action.args && Object.keys(action.args).length > 0 && (
                  <div className="stark-param-row">
                    <span className="param-k">PARAMETERS:</span>
                    <span className="param-v mono">
                      {JSON.stringify(action.args)
                        .replace(/[{"}]/g, '')
                        .replace(/,/g, ' · ')}
                    </span>
                  </div>
                )}
                <div className="stark-param-row">
                  <span className="param-k">SAFETY GATE:</span>
                  <span className="param-v highlight">USER CONFIRMATION ENFORCED</span>
                </div>
              </div>
            </div>

            <div className="stark-voice-tip">
              <span>🎙️ <b>VOICE RECOGNITION ACTIVE:</b> Say <b>"Yes"</b>, <b>"Confirm"</b>, or <b>"Authorize"</b> to proceed, or <b>"Cancel"</b> to abort.</span>
            </div>
          </div>

          {/* Interactive Confirmation Actions */}
          <div className="stark-modal-actions">
            <button
              type="button"
              className="stark-btn stark-btn-abort"
              onClick={onAbort}
              title="Cancel execution (Esc)"
            >
              <span className="btn-icon">✕</span>
              <span>ABORT DIRECTIVE [ESC]</span>
            </button>

            <button
              type="button"
              className="stark-btn stark-btn-confirm"
              onClick={onConfirm}
              title="Authorize and execute on Mac (Enter)"
            >
              <span className="btn-icon">✓</span>
              <span>AUTHORIZE PROTOCOL [ENTER]</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
