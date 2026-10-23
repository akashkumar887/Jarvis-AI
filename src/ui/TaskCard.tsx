import { useStore } from '../store'

export function TaskCard() {
  const activeTask = useStore((s) => s.activeTask)
  const timerSeconds = useStore((s) => s.timerSeconds)

  const displayTask =
    timerSeconds !== null
      ? `timer: ${Math.floor(timerSeconds / 60)}:${String(timerSeconds % 60).padStart(2, '0')}-remaining`
      : activeTask || 'desktop: screen-notes.pdf'

  return (
    <div className="hud-task-card-wrapper" aria-label="Current System Task">
      <div className="hud-task-card">
        {/* Chamfered sci-fi frame overlay */}
        <div className="task-card-accent-bracket top-left" />
        <div className="task-card-accent-bracket bottom-right" />

        <div className="task-card-label">TASK</div>
        <div className="task-card-value" title={displayTask}>
          {displayTask}
        </div>
      </div>

      {/* Decorative vertical dots flanking the task card just like in the photo */}
      <div className="task-dots-flank">
        <span className="dot-item" />
        <span className="dot-item" />
        <span className="dot-item" />
        <span className="dot-item" />
      </div>
    </div>
  )
}
