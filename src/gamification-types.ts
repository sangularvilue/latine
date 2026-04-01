/** Gamification data stored in localStorage */
export interface GamificationData {
  xp: number
  currentStreak: number
  bestStreak: number
  sessionsCompleted: number
  dailyChallengeDate: string | null
  dailyChallengePassageId: string | null
  dailyChallengeCompleted: boolean
  practiceRoundsCompleted: number
  readPassagesCompleted: string[]
  totalCorrect: number
  totalWrong: number
}

export interface Rank {
  title: string
  latinTitle: string
  minXP: number
}

/** Reading passage for Read mode */
export interface ReadingPassage {
  id: string
  source: string
  chapter: string
  latin: string
  glossary: Record<string, string>
  questions: ReadingQuestion[]
  translation: string
}

export interface ReadingQuestion {
  prompt: string
  target: string
  choices: [string, string, string, string]
}
