/**
 * Gamification — XP, streaks, levels, daily challenge.
 * Stored separately from progress to avoid breaking existing data.
 */

import type { GamificationData, Rank } from './gamification-types'

const STORAGE_KEY = 'latine-gamification'

const RANKS: Rank[] = [
  { title: 'Discipulus', latinTitle: 'Student', minXP: 0 },
  { title: 'Lector', latinTitle: 'Reader', minXP: 100 },
  { title: 'Grammaticus', latinTitle: 'Grammarian', minXP: 500 },
  { title: 'Rhetor', latinTitle: 'Rhetorician', minXP: 1500 },
  { title: 'Orator', latinTitle: 'Speaker', minXP: 4000 },
  { title: 'Magister', latinTitle: 'Master', minXP: 10000 },
  { title: 'Doctor', latinTitle: 'Scholar', minXP: 25000 },
]

function defaultData(): GamificationData {
  return {
    xp: 0,
    currentStreak: 0,
    bestStreak: 0,
    sessionsCompleted: 0,
    dailyChallengeDate: null,
    dailyChallengePassageId: null,
    dailyChallengeCompleted: false,
    practiceRoundsCompleted: 0,
    readPassagesCompleted: [],
    totalCorrect: 0,
    totalWrong: 0,
  }
}

export function loadGamification(): GamificationData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const parsed = JSON.parse(raw)
    return { ...defaultData(), ...parsed }
  } catch {
    return defaultData()
  }
}

export function saveGamification(data: GamificationData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

export function awardXP(amount: number): GamificationData {
  const data = loadGamification()
  data.xp += amount
  saveGamification(data)
  return data
}

export function recordCorrect(): GamificationData {
  const data = loadGamification()
  data.totalCorrect++
  data.currentStreak++
  if (data.currentStreak > data.bestStreak) {
    data.bestStreak = data.currentStreak
  }
  // Streak bonus XP
  const bonus = getStreakBonus(data.currentStreak)
  data.xp += bonus
  saveGamification(data)
  return data
}

export function recordWrong(): GamificationData {
  const data = loadGamification()
  data.totalWrong++
  data.currentStreak = 0
  saveGamification(data)
  return data
}

export function getStreakBonus(streak: number): number {
  if (streak >= 20) return 15
  if (streak >= 10) return 10
  if (streak >= 5) return 5
  return 0
}

export function getRank(xp: number): Rank & { nextRank: Rank | null; xpToNext: number; progress: number } {
  let current = RANKS[0]!
  let next: Rank | null = null
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i]!.minXP) {
      current = RANKS[i]!
      next = RANKS[i + 1] ?? null
      break
    }
  }
  const xpToNext = next ? next.minXP - xp : 0
  const progress = next
    ? (xp - current.minXP) / (next.minXP - current.minXP)
    : 1
  return { ...current, nextRank: next, xpToNext, progress }
}

/** Deterministic daily challenge based on date */
export function getDailyChallengeIndex(totalPassages: number): number {
  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const seed = dateStr.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return seed % totalPassages
}

export function todayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isDailyChallengeComplete(): boolean {
  const data = loadGamification()
  return data.dailyChallengeDate === todayDateStr() && data.dailyChallengeCompleted
}

export function completeDailyChallenge(passageId: string): GamificationData {
  const data = loadGamification()
  data.dailyChallengeDate = todayDateStr()
  data.dailyChallengePassageId = passageId
  data.dailyChallengeCompleted = true
  data.xp += 50 // bonus
  saveGamification(data)
  return data
}

export function completeReadPassage(id: string): GamificationData {
  const data = loadGamification()
  if (!data.readPassagesCompleted.includes(id)) {
    data.readPassagesCompleted.push(id)
  }
  saveGamification(data)
  return data
}

export function completePracticeRound(): GamificationData {
  const data = loadGamification()
  data.practiceRoundsCompleted++
  data.sessionsCompleted++
  saveGamification(data)
  return data
}

export function getAccuracy(): number {
  const data = loadGamification()
  const total = data.totalCorrect + data.totalWrong
  return total > 0 ? Math.round((data.totalCorrect / total) * 100) : 0
}
