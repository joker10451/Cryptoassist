import { cn } from '@/lib/utils'
import { motion, HTMLMotionProps } from 'framer-motion'

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode
  className?: string
  glowOnHover?: boolean
}

export function GlassCard({ children, className, glowOnHover = true, ...props }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={glowOnHover ? { scale: 1.01 } : undefined}
      className={cn(
        'relative rounded-xl p-4 bg-bg-glass backdrop-blur-xl border border-white/10',
        glowOnHover && 'hover:border-cyan-500/50 transition-all duration-300',
        className
      )}
      {...props}
    >
      {glowOnHover && (
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
      <div className="relative">{children}</div>
    </motion.div>
  )
}
