
export enum ChapterStatus {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  REVISED = 'Revised',
  MASTERED = 'Mastered'
}

export type SubjectId = 'math' | 'science' | 'english' | 'sst' | 'it' | 'sanskrit';

export type BadgeRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export interface Chapter {
  id: string;
  title: string;
  status: ChapterStatus;
  difficulty: number; // 1-5
  revisionCount: number;
  timeSpent: number; // in minutes
  category?: string; // e.g., Physics, Chemistry, Prose, Poetry
}

export interface Subject {
  id: SubjectId;
  name: string;
  icon: string;
  color: string;
  chapters: Chapter[];
}

export interface DailyActivity {
  mastered: number;
  revised: number;
  xpEarned: number;
  studyHours?: number[]; // Hours of the day when activity occurred (0-23)
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: BadgeRarity;
  points: number;
  unlocked: boolean;
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastActivityDate: string | null; // ISO Date string
  badges: string[]; // Array of Badge IDs
  totalTimeSpent: number;
  dailyWorkLog: { [dateKey: string]: DailyActivity };
  examDate: string; // ISO Date string for countdown
}

export interface DailyTarget {
  id: string;
  title: string;
  completed: boolean;
  subjectId: SubjectId;
}
