import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

export async function getProjects() {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('probability_score', { ascending: false })
    
    if (error) {
      console.error('Supabase projects error:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('Supabase projects exception:', err)
    return []
  }
}

export async function getTasks() {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, projects(name)')
      .order('difficulty', { ascending: true })
    
    if (error) {
      console.error('Supabase tasks error:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('Supabase tasks exception:', err)
    return []
  }
}

export async function getAchievements() {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('xp_reward', { ascending: false })
    
    if (error) {
      console.error('Supabase achievements error:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('Supabase achievements exception:', err)
    return []
  }
}

export type ReminderInput = {
  title: string
  message?: string
  type: 'snapshot' | 'deadline' | 'activity' | 'custom'
  scheduled_at: string
  project?: string
  channel?: string
  is_recurring?: boolean
  recurrence_rule?: string
}

export async function getReminders(userId = 'default') {
  try {
    const query = supabase
      .from('reminders')
      .select('*, projects(name)')
      .order('scheduled_at', { ascending: true })

    if (userId === 'default') {
      query.is('user_id', null)
    } else {
      query.eq('user_id', userId)
    }

    const { data, error } = await query
    
    if (error) {
      console.error('Supabase reminders error:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('Supabase reminders exception:', err)
    return []
  }
}

export async function createReminder(input: ReminderInput, userId = 'default') {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .insert({
        user_id: userId === 'default' ? null : userId,
        title: input.title,
        message: input.message,
        type: input.type,
        scheduled_at: input.scheduled_at,
        channel: input.channel || 'in_app',
        is_recurring: input.is_recurring || false,
        recurrence_rule: input.recurrence_rule,
      })
      .select()
    
    if (error) {
      console.error('Supabase create reminder error:', error.message)
      return null
    }
    return data?.[0] || null
  } catch (err) {
    console.error('Supabase create reminder exception:', err)
    return null
  }
}

export async function deleteReminder(id: string, userId = 'default') {
  try {
    const query = supabase
      .from('reminders')
      .delete()
      .eq('id', id)
    
    if (userId !== 'default') {
      query.eq('user_id', userId)
    }
    
    const { error } = await query
    
    if (error) {
      console.error('Supabase delete reminder error:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('Supabase delete reminder exception:', err)
    return false
  }
}

export async function completeReminder(id: string, userId = 'default') {
  try {
    const query = supabase
      .from('reminders')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', id)
    
    if (userId !== 'default') {
      query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Supabase complete reminder error:', error.message)
      return false
    }
    return !!data
  } catch (err) {
    console.error('Supabase complete reminder exception:', err)
    return false
  }
}

export type WalletInput = {
  address: string
  label?: string
  tags?: string[]
  chain?: string
}

export async function getWallets(userId = 'default') {
  try {
    const query = supabase
      .from('wallets')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (userId === 'default') {
      query.is('user_id', null)
    } else {
      query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Supabase wallets error:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('Supabase wallets exception:', err)
    return []
  }
}

export async function createWallet(input: WalletInput, userId = 'default') {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .insert({
        user_id: userId === 'default' ? null : userId,
        address: input.address,
        label: input.label || null,
        tags: input.tags || [],
        chain: input.chain || 'ethereum',
      })
      .select()
    
    if (error) {
      console.error('Supabase create wallet error:', error.message)
      return null
    }
    return data?.[0] || null
  } catch (err) {
    console.error('Supabase create wallet exception:', err)
    return null
  }
}

export async function deleteWallet(id: string, userId = 'default') {
  try {
    const query = supabase
      .from('wallets')
      .delete()
      .eq('id', id)
    
    if (userId !== 'default') {
      query.eq('user_id', userId)
    }
    
    const { error } = await query
    
    if (error) {
      console.error('Supabase delete wallet error:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('Supabase delete wallet exception:', err)
    return false
  }
}

export async function updateWallet(id: string, input: Partial<WalletInput>, userId = 'default') {
  try {
    const query = supabase
      .from('wallets')
      .update({
        ...(input.label !== undefined && { label: input.label }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.chain !== undefined && { chain: input.chain }),
      })
      .eq('id', id)
    
    if (userId !== 'default') {
      query.eq('user_id', userId)
    }
    
    const { data, error } = await query.select()
    
    if (error) {
      console.error('Supabase update wallet error:', error.message)
      return null
    }
    return data?.[0] || null
  } catch (err) {
    console.error('Supabase update wallet exception:', err)
    return null
  }
}

export type TaskInput = {
  title: string
  task_type: string
  description?: string
  difficulty?: number
  project_id?: string
  deadline?: string
}

// NOTE: таблица `tasks` — глобальные шаблоны без user_id. Имя колонки — task_type, не type.
// Для персонального отслеживания прогресса используется user_tasks (status, completed_at, proof_url).
export async function createTask(input: TaskInput, _userId = 'default') {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: input.title,
        task_type: input.task_type,
        description: input.description || null,
        difficulty: input.difficulty || 3,
        project_id: input.project_id || null,
        deadline: input.deadline || null,
        status: 'pending',
      })
      .select()

    if (error) {
      console.error('Supabase create task error:', error.message)
      return null
    }
    return data?.[0] || null
  } catch (err) {
    console.error('Supabase create task exception:', err)
    return null
  }
}

export async function createTasksBatch(inputs: TaskInput[], _userId = 'default') {
  try {
    const tasks = inputs.map(input => ({
      title: input.title,
      task_type: input.task_type,
      description: input.description || null,
      difficulty: input.difficulty || 3,
      project_id: input.project_id || null,
      deadline: input.deadline || null,
      status: 'pending',
    }))

    const { data, error } = await supabase
      .from('tasks')
      .insert(tasks)
      .select()

    if (error) {
      console.error('Supabase create batch tasks error:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('Supabase create batch tasks exception:', err)
    return []
  }
}
