import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'cyan' | 'purple' | 'green' | 'red' | 'yellow' | 'orange'
  className?: string
}

export function Badge({ children, variant = 'cyan', className }: BadgeProps) {
  const variants = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    green: 'bg-green-500/10 text-green-400 border-green-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  }

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 text-xs font-mono rounded-md border',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}
