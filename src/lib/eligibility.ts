/**
 * Wallet Eligibility Engine.
 *
 * Сравнивает on-chain метрики кошелька с правилами проектов.
 * Возвращает % eligibility + список выполненных/невыполненных правил.
 */

import type { WalletAnalysis } from './onchain'

export interface EligibilityRule {
  id: string
  description: string
  weight: number // 1-10, важность правила
  check: (wallet: WalletAnalysis) => boolean
}

export interface ProjectEligibility {
  projectSlug: string
  projectName: string
  score: number // 0-100
  rulesMet: number
  rulesTotal: number
  met: string[]
  missing: string[]
}

interface ProjectRuleSet {
  slug: string
  name: string
  rules: EligibilityRule[]
}

/**
 * Предопределённые правила для известных проектов.
 * Для проектов без правил — используем generic set.
 */
const PROJECT_RULES: ProjectRuleSet[] = [
  {
    slug: 'scroll',
    name: 'Scroll',
    rules: [
      { id: 'tx10', description: 'Минимум 10 транзакций в любой сети', weight: 8, check: (w) => w.totalTxCount >= 10 },
      { id: 'tx50', description: '50+ транзакций (продвинутый)', weight: 5, check: (w) => w.totalTxCount >= 50 },
      { id: 'age90', description: 'Кошелёк старше 90 дней', weight: 7, check: (w) => w.walletAge >= 90 },
      { id: 'age180', description: 'Кошелёк старше 180 дней', weight: 4, check: (w) => w.walletAge >= 180 },
      { id: 'multi_chain', description: 'Активность в 3+ сетях', weight: 6, check: (w) => w.chains.filter((c) => c.txCount > 0).length >= 3 },
      { id: 'has_tokens', description: 'Держит ERC-20 токены', weight: 3, check: (w) => w.chains.some((c) => c.tokens.length > 0) },
      { id: 'value_500', description: 'Баланс $500+', weight: 5, check: (w) => w.totalUsdValue >= 500 },
    ],
  },
  {
    slug: 'berachain',
    name: 'Berachain',
    rules: [
      { id: 'tx5', description: 'Минимум 5 транзакций', weight: 7, check: (w) => w.totalTxCount >= 5 },
      { id: 'age30', description: 'Кошелёк старше 30 дней', weight: 6, check: (w) => w.walletAge >= 30 },
      { id: 'multi_chain', description: 'Активность в 2+ сетях', weight: 5, check: (w) => w.chains.filter((c) => c.txCount > 0).length >= 2 },
      { id: 'has_eth', description: 'Держит ETH', weight: 4, check: (w) => parseFloat(w.balance) > 0.01 },
      { id: 'value_100', description: 'Баланс $100+', weight: 4, check: (w) => w.totalUsdValue >= 100 },
    ],
  },
  {
    slug: 'megaeth',
    name: 'MegaETH',
    rules: [
      { id: 'tx10', description: 'Минимум 10 транзакций', weight: 7, check: (w) => w.totalTxCount >= 10 },
      { id: 'age60', description: 'Кошелёк старше 60 дней', weight: 5, check: (w) => w.walletAge >= 60 },
      { id: 'has_eth', description: 'Держит ETH (для бриджа)', weight: 6, check: (w) => parseFloat(w.balance) > 0.01 },
      { id: 'multi_chain', description: 'Активность в 3+ сетях', weight: 5, check: (w) => w.chains.filter((c) => c.txCount > 0).length >= 3 },
      { id: 'base_active', description: 'Активность в Base', weight: 4, check: (w) => (w.chains.find((c) => c.chain === 'base')?.txCount ?? 0) > 0 },
    ],
  },
  {
    slug: 'monad',
    name: 'Monad',
    rules: [
      { id: 'tx20', description: '20+ транзакций', weight: 8, check: (w) => w.totalTxCount >= 20 },
      { id: 'age90', description: 'Кошелёк старше 90 дней', weight: 6, check: (w) => w.walletAge >= 90 },
      { id: 'multi_chain', description: 'Активность в 3+ сетях', weight: 6, check: (w) => w.chains.filter((c) => c.txCount > 0).length >= 3 },
      { id: 'value_1000', description: 'Баланс $1000+', weight: 5, check: (w) => w.totalUsdValue >= 1000 },
      { id: 'has_tokens', description: 'Держит ERC-20 токены', weight: 3, check: (w) => w.chains.some((c) => c.tokens.length > 0) },
    ],
  },
  {
    slug: 'hyperlane',
    name: 'Hyperlane',
    rules: [
      { id: 'multi_chain3', description: 'Активность в 3+ сетях (cross-chain)', weight: 9, check: (w) => w.chains.filter((c) => c.txCount > 0).length >= 3 },
      { id: 'multi_chain5', description: 'Активность в 5+ сетях', weight: 5, check: (w) => w.chains.filter((c) => c.txCount > 0).length >= 5 },
      { id: 'tx10', description: '10+ транзакций', weight: 6, check: (w) => w.totalTxCount >= 10 },
      { id: 'age60', description: 'Кошелёк старше 60 дней', weight: 5, check: (w) => w.walletAge >= 60 },
      { id: 'has_eth', description: 'Держит ETH', weight: 3, check: (w) => parseFloat(w.balance) > 0.01 },
    ],
  },
  {
    slug: 'aztec-network',
    name: 'Aztec Network',
    rules: [
      { id: 'tx20', description: '20+ транзакций (privacy L2 ценит активность)', weight: 8, check: (w) => w.totalTxCount >= 20 },
      { id: 'age180', description: 'Кошелёк старше 180 дней', weight: 7, check: (w) => w.walletAge >= 180 },
      { id: 'eth_balance', description: 'Держит ETH (для gas на L2)', weight: 6, check: (w) => parseFloat(w.balance) > 0.05 },
      { id: 'multi_chain', description: 'Активность в 3+ сетях', weight: 5, check: (w) => w.chains.filter((c) => c.txCount > 0).length >= 3 },
      { id: 'value_500', description: 'Баланс $500+', weight: 5, check: (w) => w.totalUsdValue >= 500 },
      { id: 'has_tokens', description: 'Держит ERC-20 токены', weight: 3, check: (w) => w.chains.some((c) => c.tokens.length > 0) },
    ],
  },
  {
    slug: 'initia',
    name: 'Initia',
    rules: [
      { id: 'tx10', description: '10+ транзакций', weight: 7, check: (w) => w.totalTxCount >= 10 },
      { id: 'age60', description: 'Кошелёк старше 60 дней', weight: 6, check: (w) => w.walletAge >= 60 },
      { id: 'multi_chain', description: 'Активность в 2+ сетях', weight: 5, check: (w) => w.chains.filter((c) => c.txCount > 0).length >= 2 },
      { id: 'has_eth', description: 'Держит ETH', weight: 5, check: (w) => parseFloat(w.balance) > 0.01 },
      { id: 'value_200', description: 'Баланс $200+', weight: 4, check: (w) => w.totalUsdValue >= 200 },
    ],
  },
  {
    slug: 'fuel-network',
    name: 'Fuel Network',
    rules: [
      { id: 'tx10', description: '10+ транзакций', weight: 7, check: (w) => w.totalTxCount >= 10 },
      { id: 'age90', description: 'Кошелёк старше 90 дней', weight: 6, check: (w) => w.walletAge >= 90 },
      { id: 'multi_chain', description: 'Активность в 3+ сетях (modular = multi-chain)', weight: 7, check: (w) => w.chains.filter((c) => c.txCount > 0).length >= 3 },
      { id: 'has_eth', description: 'Держит ETH (для бриджа)', weight: 5, check: (w) => parseFloat(w.balance) > 0.01 },
      { id: 'value_300', description: 'Баланс $300+', weight: 4, check: (w) => w.totalUsdValue >= 300 },
      { id: 'arb_active', description: 'Активность в Arbitrum', weight: 4, check: (w) => (w.chains.find((c) => c.chain === 'arbitrum')?.txCount ?? 0) > 0 },
    ],
  },
]

/**
 * Generic rules для проектов без специфических правил.
 */
const GENERIC_RULES: EligibilityRule[] = [
  { id: 'tx5', description: 'Минимум 5 транзакций', weight: 7, check: (w) => w.totalTxCount >= 5 },
  { id: 'age30', description: 'Кошелёк старше 30 дней', weight: 6, check: (w) => w.walletAge >= 30 },
  { id: 'multi_chain', description: 'Активность в 2+ сетях', weight: 5, check: (w) => w.chains.filter((c) => c.txCount > 0).length >= 2 },
  { id: 'has_tokens', description: 'Держит ERC-20 токены', weight: 4, check: (w) => w.chains.some((c) => c.tokens.length > 0) },
  { id: 'value_100', description: 'Баланс $100+', weight: 4, check: (w) => w.totalUsdValue >= 100 },
]

function evaluateRules(wallet: WalletAnalysis, rules: EligibilityRule[]): {
  score: number
  met: string[]
  missing: string[]
} {
  let totalWeight = 0
  let metWeight = 0
  const met: string[] = []
  const missing: string[] = []

  for (const rule of rules) {
    totalWeight += rule.weight
    if (rule.check(wallet)) {
      metWeight += rule.weight
      met.push(rule.description)
    } else {
      missing.push(rule.description)
    }
  }

  const score = totalWeight > 0 ? Math.round((metWeight / totalWeight) * 100) : 0
  return { score, met, missing }
}

/**
 * Проверить eligibility кошелька для конкретного проекта.
 */
export function checkEligibility(
  wallet: WalletAnalysis,
  projectSlug: string,
  projectName?: string,
): ProjectEligibility {
  const ruleSet = PROJECT_RULES.find((r) => r.slug === projectSlug)
  const rules = ruleSet?.rules ?? GENERIC_RULES
  const name = ruleSet?.name ?? projectName ?? projectSlug

  const { score, met, missing } = evaluateRules(wallet, rules)

  return {
    projectSlug,
    projectName: name,
    score,
    rulesMet: met.length,
    rulesTotal: rules.length,
    met,
    missing,
  }
}

/**
 * Проверить eligibility кошелька для всех проектов с правилами.
 */
export function checkAllEligibility(wallet: WalletAnalysis): ProjectEligibility[] {
  return PROJECT_RULES.map((ruleSet) => {
    const { score, met, missing } = evaluateRules(wallet, ruleSet.rules)
    return {
      projectSlug: ruleSet.slug,
      projectName: ruleSet.name,
      score,
      rulesMet: met.length,
      rulesTotal: ruleSet.rules.length,
      met,
      missing,
    }
  }).sort((a, b) => b.score - a.score)
}

/** Список проектов с правилами (для UI). */
export function getAvailableRuleSets(): { slug: string; name: string; rulesCount: number }[] {
  return PROJECT_RULES.map((r) => ({ slug: r.slug, name: r.name, rulesCount: r.rules.length }))
}
