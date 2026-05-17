interface ProgressBarProps {
  progress: number
  className?: string
  showLabel?: boolean
  color?: 'cyan' | 'purple' | 'green' | 'red' | 'yellow'
}

export function ProgressBar({ progress, className, showLabel = false, color = 'cyan' }: ProgressBarProps) {
  const colors = {
    cyan: 'from-cyan-500 to-cyan-400',
    purple: 'from-purple-500 to-purple-400',
    green: 'from-green-500 to-green-400',
    red: 'from-red-500 to-red-400',
    yellow: 'from-yellow-500 to-yellow-400',
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        {showLabel && (
          <span className="text-xs text-text-secondary font-mono">{progress}%</span>
        )}
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colors[color]} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  )
}
