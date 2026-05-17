-- Crypto Hunter OS Database Schema

-- PROJECTS
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  ecosystem TEXT,
  funding_amount DECIMAL,
  funding_currency TEXT DEFAULT 'USD',
  investors TEXT[] DEFAULT '{}',
  token_status TEXT DEFAULT 'no_token',
  snapshot_status TEXT DEFAULT 'unknown',
  snapshot_date TIMESTAMP WITH TIME ZONE,
  estimated_reward_min DECIMAL,
  estimated_reward_max DECIMAL,
  farming_difficulty INTEGER DEFAULT 5,
  risk_score INTEGER DEFAULT 5,
  farming_cost DECIMAL DEFAULT 0,
  probability_score INTEGER DEFAULT 50,
  deadline TIMESTAMP WITH TIME ZONE,
  website_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  telegram_url TEXT,
  docs_url TEXT,
  github_url TEXT,
  ai_summary TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TASKS
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'social',
  requirement_type TEXT DEFAULT 'quest',
  target_value DECIMAL,
  target_unit TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_interval TEXT,
  difficulty INTEGER DEFAULT 3,
  estimated_time_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ACHIEVEMENTS
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  rarity TEXT DEFAULT 'common',
  xp_reward INTEGER DEFAULT 0,
  criteria JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free',
  xp INTEGER DEFAULT 0,
  farmer_level INTEGER DEFAULT 1,
  streak_days INTEGER DEFAULT 0,
  last_active DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WALLETS
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  label TEXT,
  tags TEXT[] DEFAULT '{}',
  chain TEXT DEFAULT 'ethereum',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USER_PROJECTS
CREATE TABLE user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id),
  status TEXT DEFAULT 'tracking',
  progress INTEGER DEFAULT 0,
  notes TEXT,
  reminder_enabled BOOLEAN DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, project_id, wallet_id)
);

-- USER_TASKS
CREATE TABLE user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id),
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  proof_url TEXT,
  xp_reward INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- REMINDERS
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  task_id UUID REFERENCES tasks(id),
  type TEXT DEFAULT 'custom',
  title TEXT NOT NULL,
  message TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  channel TEXT DEFAULT 'in_app',
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USER_ACHIEVEMENTS
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- AI_ANALYSES
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  wallet_id UUID REFERENCES wallets(id),
  analysis_type TEXT,
  input_data JSONB,
  output_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MISSED_OPPORTUNITIES
CREATE TABLE missed_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  reason TEXT,
  completion_percentage INTEGER,
  estimated_lost_value DECIMAL,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_dismissed BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX idx_user_tasks_user_id ON user_tasks(user_id);
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_scheduled_at ON reminders(scheduled_at);
CREATE INDEX idx_projects_probability_score ON projects(probability_score);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE missed_opportunities ENABLE ROW LEVEL SECURITY;

-- Public read for projects, tasks, achievements
CREATE POLICY "Public read projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Public read tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "Public read achievements" ON achievements FOR SELECT USING (true);

-- Full access for user tables (for personal use)
CREATE POLICY "Full access users" ON users FOR ALL USING (true);
CREATE POLICY "Full access wallets" ON wallets FOR ALL USING (true);
CREATE POLICY "Full access user_projects" ON user_projects FOR ALL USING (true);
CREATE POLICY "Full access user_tasks" ON user_tasks FOR ALL USING (true);
CREATE POLICY "Full access reminders" ON reminders FOR ALL USING (true);
CREATE POLICY "Full access user_achievements" ON user_achievements FOR ALL USING (true);
CREATE POLICY "Full access ai_analyses" ON ai_analyses FOR ALL USING (true);
CREATE POLICY "Full access missed_opportunities" ON missed_opportunities FOR ALL USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== SEED DATA =====

-- Projects
INSERT INTO projects (name, slug, description, category, ecosystem, funding_amount, funding_currency, investors, token_status, snapshot_status, snapshot_date, estimated_reward_min, estimated_reward_max, farming_difficulty, risk_score, farming_cost, probability_score, website_url, twitter_url, discord_url, docs_url, github_url, ai_summary, status) VALUES
('LayerZero', 'layerzero', 'Омничейн протокол для межсетевого взаимодействия', 'infra', 'multi-chain', 283000000, 'USD', '{"a16z","Sequoia","Coinbase Ventures"}', 'no_token', 'upcoming', '2025-06-01T00:00:00Z', 3000, 8000, 6, 3, 100, 92, 'https://layerzero.network', 'https://twitter.com/LayerZero_Labs', 'https://discord.gg/layerzero', 'https://layerzero.network/docs', 'https://github.com/LayerZero-Labs', 'LayerZero — омничейн-протокол с сильным бэкраундом. Токен не запущен. Высокая вероятность ретроактивного аирдропа.', 'active'),
('zkSync', 'zksync', 'ZK-rollup Layer 2 решение для Ethereum', 'layer2', 'ethereum', 458000000, 'USD', '{"a16z","Blockchain Capital","Dragonfly"}', 'announced', 'active', '2025-05-19T00:00:00Z', 2000, 5000, 5, 2, 50, 88, 'https://zksync.io', 'https://twitter.com/zksync', 'https://discord.gg/zksync', 'https://docs.zksync.io', 'https://github.com/matter-labs', 'zkSync — лидер ZK-rollup. Snapshot активен. Рекомендуется выполнить минимум 2 транзакции.', 'active'),
('Scroll', 'scroll', 'zkEVM Layer 2 с нативной совместимостью', 'layer2', 'ethereum', 80000000, 'USD', '{"Polychain","Bain Capital Crypto","Robot Ventures"}', 'no_token', 'unknown', NULL, 1500, 4000, 5, 4, 30, 87, 'https://scroll.io', 'https://twitter.com/Scroll_ZKP', 'https://discord.gg/scroll', 'https://docs.scroll.io', 'https://github.com/scroll-tech', 'Scroll — zkEVM L2 с $80M funding. Токен не запущен. Активный тестнет.', 'active'),
('StarkNet', 'starknet', 'Валидити роллап (ZK-rollup) Layer 2', 'layer2', 'ethereum', 270000000, 'USD', '{"Sequoia","Paradigm","Tiger Global"}', 'launched', 'passed', '2024-11-01T00:00:00Z', 1000, 3000, 7, 3, 80, 78, 'https://starknet.io', 'https://twitter.com/StarkNetEco', 'https://discord.gg/starknet', 'https://docs.starknet.io', 'https://github.com/starkware-libs', 'StarkNet — ZK-rollup от StarkWare. Токен STRK запущен. Возможен второй раунд.', 'active'),
('Monad', 'monad', 'Высокопроизводительный EVM-совместимый L1', 'layer1', 'ethereum', 225000000, 'USD', '{"Paradigm","Coinbase Ventures","Dragonfly"}', 'no_token', 'unknown', NULL, 1500, 4000, 5, 5, 20, 78, 'https://monad.xyz', 'https://twitter.com/monad_xyz', 'https://discord.gg/monad', 'https://docs.monad.xyz', NULL, 'Monad — новый L1 с $225M funding от Paradigm. Тестнет активен.', 'active'),
('Berachain', 'berachain', 'EVM-совместимый L1 с Proof-of-Liquidity', 'layer1', 'cosmos', 100000000, 'USD', '{"Hack VC","Polychain","Robot Ventures"}', 'no_token', 'unknown', NULL, 800, 2500, 4, 5, 0, 72, 'https://berachain.com', 'https://twitter.com/berachain', 'https://discord.gg/berachain', 'https://docs.berachain.com', 'https://github.com/berachain', 'Berachain — L1 с уникальным Proof-of-Liquidity. Бесплатный тестнет.', 'active'),
('EigenLayer', 'eigenlayer', 'Протокол рестейкинга для Ethereum', 'defi', 'ethereum', 145000000, 'USD', '{"Blockchain Capital","Paradigm","Coinbase Ventures"}', 'launched', 'passed', '2024-06-01T00:00:00Z', 2000, 6000, 8, 4, 500, 65, 'https://eigenlayer.xyz', 'https://twitter.com/eigenlayer', 'https://discord.gg/eigenlayer', 'https://docs.eigenlayer.xyz', 'https://github.com/Layr-Labs', 'EigenLayer — протокол рестейкинга. Токен EIGEN запущен.', 'active'),
('Hyperlane', 'hyperlane', 'Permissionless протокол межсетевого взаимодействия', 'infra', 'multi-chain', 55000000, 'USD', '{"Coinbase Ventures","Bain Capital Crypto","Robot Ventures"}', 'no_token', 'unknown', NULL, 1000, 3000, 4, 5, 15, 70, 'https://hyperlane.xyz', 'https://twitter.com/Hyperlane_xyz', 'https://discord.gg/hyperlane', 'https://docs.hyperlane.xyz', 'https://github.com/hyperlane-xyz', 'Hyperlane — permissionless interoperability. Токен не запущен.', 'active');

-- Tasks
INSERT INTO tasks (project_id, title, description, task_type, requirement_type, target_value, target_unit, deadline, difficulty, estimated_time_minutes)
SELECT p.id, t.title, t.description, t.task_type, t.requirement_type, t.target_value, t.target_unit, t.deadline, t.difficulty, t.estimated_time_minutes
FROM projects p
CROSS JOIN LATERAL (VALUES
  ('layerzero', 'Бридж ETH через Stargate', 'Бридж минимум 0.1 ETH', 'bridge', 'tx_count', 1, 'transactions', NULL::timestamp with time zone, 3, 15),
  ('layerzero', 'Свап на SushiSwap', 'Выполнить минимум 1 свап', 'swap', 'tx_count', 1, 'transactions', NULL, 2, 10),
  ('layerzero', 'Стейк STG токенов', 'Застейкать STG токены', 'stake', 'tx_count', 1, 'transactions', NULL, 3, 10),
  ('layerzero', 'Зайти в Discord + роль', 'Присоединиться и верифицироваться', 'discord', 'role', 1, 'boolean', NULL, 1, 5),
  ('layerzero', '5 бридж транзакций', 'Бридж активов минимум 5 раз', 'bridge', 'tx_count', 5, 'transactions', NULL, 5, 60),
  ('zksync', 'Бридж на zkSync Era', 'Бридж ETH на zkSync Era', 'bridge', 'tx_count', 1, 'transactions', '2025-05-19T00:00:00Z', 3, 15),
  ('zksync', 'Свап на SyncSwap', 'Свап на SyncSwap DEX', 'swap', 'tx_count', 1, 'transactions', '2025-05-19T00:00:00Z', 2, 10),
  ('zksync', 'Предоставить ликвидность', 'Добавить ликвидность в пул', 'stake', 'volume', 100, 'usd', '2025-05-19T00:00:00Z', 4, 20),
  ('scroll', 'Бридж на Scroll', 'Бридж ETH на Scroll', 'bridge', 'tx_count', 1, 'transactions', NULL, 3, 15),
  ('scroll', '3 свапа на Scroll DEX', 'Минимум 3 свапа', 'swap', 'tx_count', 3, 'transactions', NULL, 3, 30),
  ('monad', 'Зайти в Monad тестнет', 'Участвовать в тестнете', 'testnet', 'tx_count', 1, 'transactions', NULL, 2, 20),
  ('monad', 'Galxe квесты', 'Социальные квесты на Galxe', 'social', 'quest', 5, 'quests', NULL, 2, 30),
  ('berachain', 'Berachain тестнет', 'Участвовать в bArtio тестнете', 'testnet', 'tx_count', 1, 'transactions', NULL, 1, 15),
  ('berachain', 'Социальные квесты', 'Twitter, Discord, Zealy', 'social', 'quest', 3, 'quests', NULL, 1, 20)
) AS t(slug, title, description, task_type, requirement_type, target_value, target_unit, deadline, difficulty, estimated_time_minutes)
WHERE p.slug = t.slug;

-- Achievements
INSERT INTO achievements (slug, name, description, icon, rarity, xp_reward, criteria) VALUES
('first-blood', 'Первая кровь', 'Завершил первый проект', '🥇', 'common', 50, '{"type":"projects_completed","value":1}'),
('task-master', 'Мастер задач', 'Выполнил 100 задач', '🥈', 'uncommon', 200, '{"type":"tasks_done","value":100}'),
('whale', 'Кит', 'Портфель $10K+', '🥉', 'rare', 500, '{"type":"portfolio_value","value":10000}'),
('streak-lord', 'Повелитель стриков', '30 дней стрик', '🔥', 'uncommon', 300, '{"type":"streak_days","value":30}'),
('sniper', 'Снайпер', '90%+ завершение на 5 проектах', '🎯', 'rare', 400, '{"type":"high_completion_projects","value":5}'),
('diamond-hands', 'Алмазные руки', 'Отслеживал проект 180+ дней', '💎', 'epic', 600, '{"type":"tracking_days","value":180}'),
('ai-whisperer', 'Шептатель ИИ', 'Использовал ИИ парсер 25 раз', '🧠', 'uncommon', 250, '{"type":"ai_uses","value":25}'),
('multi-chain', 'Мультичейн', 'Активен на 5+ сетях', '🌐', 'rare', 350, '{"type":"chains_active","value":5}');
