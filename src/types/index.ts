export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  plan: 'free' | 'pro';
  xp: number;
  farmer_level: number;
  streak_days: number;
  last_active: string;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  address: string;
  label: string | null;
  tags: string[];
  chain: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  ecosystem: string | null;
  funding_amount: number | null;
  funding_currency: string;
  investors: string[];
  token_status: 'no_token' | 'rumored' | 'announced' | 'launched';
  snapshot_status: 'unknown' | 'active' | 'passed' | 'upcoming';
  snapshot_date: string | null;
  estimated_reward_min: number | null;
  estimated_reward_max: number | null;
  farming_difficulty: number;
  risk_score: number;
  farming_cost: number;
  probability_score: number;
  deadline: string | null;
  website_url: string | null;
  twitter_url: string | null;
  discord_url: string | null;
  telegram_url: string | null;
  docs_url: string | null;
  github_url: string | null;
  ai_summary: string | null;
  status: 'active' | 'ended' | 'claimed';
  referral_url?: string | null;
  referral_code?: string | null;
  referral_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProject {
  id: string;
  user_id: string;
  project_id: string;
  wallet_id: string | null;
  status: 'tracking' | 'in_progress' | 'completed' | 'missed' | 'claimed';
  progress: number;
  notes: string | null;
  reminder_enabled: boolean;
  started_at: string;
  completed_at: string | null;
  project?: Project;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  task_type: 'swap' | 'bridge' | 'stake' | 'mint' | 'discord' | 'social' | 'testnet';
  requirement_type: 'tx_count' | 'volume' | 'wallet_age' | 'role' | 'quest';
  target_value: number | null;
  target_unit: string | null;
  deadline: string | null;
  is_recurring: boolean;
  recurrence_interval: string | null;
  difficulty: number;
  estimated_time_minutes: number | null;
  created_at: string;
  /** Joined from projects when selected via `select('*, projects(name)')`. */
  projects?: { name: string } | null;
}

export interface UserTask {
  id: string;
  user_id: string;
  task_id: string;
  wallet_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completed_at: string | null;
  proof_url: string | null;
  xp_reward: number;
  created_at: string;
  task?: Task;
}

export interface Reminder {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  type: 'snapshot' | 'deadline' | 'activity' | 'claim' | 'custom';
  title: string;
  message: string | null;
  scheduled_at: string;
  sent_at: string | null;
  channel: 'in_app' | 'email' | 'telegram' | 'push';
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_at: string;
}

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  xp_reward: number;
  criteria: Record<string, any>;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

export interface AIAnalysis {
  id: string;
  user_id: string | null;
  project_id: string | null;
  wallet_id: string | null;
  analysis_type: 'opportunity_score' | 'project_summary' | 'task_parse' | 'wallet_analysis';
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  created_at: string;
}

export interface MissedOpportunity {
  id: string;
  user_id: string;
  project_id: string | null;
  reason: string;
  completion_percentage: number;
  estimated_lost_value: number | null;
  detected_at: string;
  is_dismissed: boolean;
  project?: Project;
}
