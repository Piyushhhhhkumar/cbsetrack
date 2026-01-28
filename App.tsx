
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { INITIAL_SUBJECTS, BADGES, MOTIVATIONAL_QUOTES } from './constants.tsx';
import { Subject, ChapterStatus, UserStats, SubjectId, BadgeRarity, Badge, Chapter } from './types.ts';
import { getCoachAdvice } from './geminiService.ts';

// --- Helper Functions ---
const getDateKey = (date: Date = new Date()) => date.toISOString().split('T')[0];

const isYesterdayOf = (targetDateStr: string, todayDateStr: string) => {
  const t = new Date(targetDateStr);
  const d = new Date(todayDateStr);
  d.setDate(d.getDate() - 1);
  return t.toISOString().split('T')[0] === d.toISOString().split('T')[0];
};

const calculateLevel = (xp: number) => Math.floor(xp / 500) + 1;

const getDifficultyInfo = (level: number) => {
  if (level >= 4) return { label: 'Hard', icon: '🔥', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900' };
  if (level === 3) return { label: 'Medium', icon: '⚖️', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900' };
  return { label: 'Easy', icon: '✅', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900' };
};

// --- Sub-components ---

const ProgressCircle: React.FC<{ percentage: number, color: string, size?: 'sm' | 'lg' }> = ({ percentage, color, size = 'sm' }) => {
  const radius = size === 'sm' ? 18 : 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className={`transform -rotate-90 ${size === 'sm' ? 'w-12 h-12' : 'w-24 h-24'}`}>
        <circle cx={size === 'sm' ? 24 : 48} cy={size === 'sm' ? 24 : 48} r={radius} stroke="currentColor" strokeWidth={size === 'sm' ? '4' : '8'} fill="transparent" className="text-gray-200 dark:text-slate-800" />
        <circle cx={size === 'sm' ? 24 : 48} cy={size === 'sm' ? 24 : 48} r={radius} stroke="currentColor" strokeWidth={size === 'sm' ? '4' : '8'} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" fill="transparent" className={color} />
      </svg>
      <span className={`absolute font-bold text-gray-700 dark:text-slate-200 ${size === 'sm' ? 'text-[10px]' : 'text-lg'}`}>
        {Math.round(percentage)}%
      </span>
    </div>
  );
};

const Card: React.FC<{ children?: React.ReactNode, className?: string, onClick?: () => void }> = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 ${onClick ? 'cursor-pointer active:scale-[0.98] transition-all' : ''} ${className}`}
  >
    {children}
  </div>
);

const BadgeIcon: React.FC<{ badge: Badge, isUnlocked: boolean }> = ({ badge, isUnlocked }) => {
  const rarityStyles: Record<BadgeRarity, string> = {
    'Common': 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400',
    'Rare': 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 text-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.2)]',
    'Epic': 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    'Legendary': 'border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30 text-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-pulse'
  };

  const unlockedStyles: Record<BadgeRarity, string> = {
    'Common': 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100',
    'Rare': 'border-blue-400 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100',
    'Epic': 'border-amber-400 bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100',
    'Legendary': 'border-purple-500 bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-blue-100'
  };

  return (
    <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-2xl transition-all duration-500 ${isUnlocked ? unlockedStyles[badge.rarity] : 'grayscale opacity-40 ' + rarityStyles[badge.rarity]}`}>
      {badge.icon}
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subjects' | 'analysis'>('dashboard');
  const [selectedSubjectId, setSelectedSubjectId] = useState<SubjectId>('math');
  const [isEditingExamDate, setIsEditingExamDate] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [newlyUnlockedBadge, setNewlyUnlockedBadge] = useState<Badge | null>(null);
  const [activeNudge, setActiveNudge] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('cbse_subjects');
    return saved ? JSON.parse(saved) : INITIAL_SUBJECTS;
  });

  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('cbse_stats');
    const defaultStats: UserStats = { 
      xp: 0, 
      level: 1, 
      streak: 0, 
      lastActivityDate: null, 
      badges: [], 
      totalTimeSpent: 0, 
      dailyWorkLog: {}, 
      examDate: '2026-02-16' 
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultStats, ...parsed };
      } catch (e) {
        return defaultStats;
      }
    }
    return defaultStats;
  });

  const [coachMessage, setCoachMessage] = useState<string>("Welcome back! Let's conquer today's goals.");

  // --- Persistence & Initialization ---
  useEffect(() => {
    localStorage.setItem('cbse_subjects', JSON.stringify(subjects));
    localStorage.setItem('cbse_stats', JSON.stringify(stats));
  }, [subjects, stats]);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- Auto-Nudge Logic ---
  useEffect(() => {
    const triggerNudge = (msg: string) => {
      setActiveNudge(msg);
      setTimeout(() => setActiveNudge(null), 8000);
    };

    const hour = new Date().getHours();
    let welcome = "Ready for a productive session?";
    if (hour < 7) welcome = "Early study pays off! You're ahead of the curve.";
    else if (hour > 21) welcome = "Night session? Make it count, but don't forget to sleep!";
    
    const timeout = setTimeout(() => triggerNudge(welcome), 3000);

    const nudgeInterval = setInterval(() => {
      const randomMsg = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
      const hardChapters = subjects.flatMap(s => s.chapters.filter(c => c.difficulty >= 4 && c.status !== ChapterStatus.MASTERED));
      if (hardChapters.length > 0 && Math.random() > 0.5) {
        const target = hardChapters[Math.floor(Math.random() * hardChapters.length)];
        triggerNudge(`Hey! How about tackling "${target.title}"? It's a hard one, but you can do it!`);
      } else {
        triggerNudge(randomMsg);
      }
    }, 300000);

    return () => {
      clearTimeout(timeout);
      clearInterval(nudgeInterval);
    };
  }, [subjects]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const today = getDateKey();
    setStats(prev => {
      if (!prev.lastActivityDate) return prev;
      if (prev.lastActivityDate !== today && !isYesterdayOf(prev.lastActivityDate, today)) {
        return { ...prev, streak: 0 };
      }
      return prev;
    });

    fetchAdvice();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Badge Unlocking Logic ---
  useEffect(() => {
    const checkBadges = () => {
      const currentBadgeIds = new Set(stats.badges);
      const newlyFoundIds: string[] = [];
      let bonusXp = 0;

      const totalMastered = subjects.reduce((a, s) => a + s.chapters.filter(c => c.status === ChapterStatus.MASTERED).length, 0);
      const totalRevisions = subjects.reduce((a, s) => a + s.chapters.reduce((sum, c) => sum + c.revisionCount, 0), 0);
      const today = getDateKey();
      const currentHour = new Date().getHours();

      BADGES.forEach(badge => {
        if (currentBadgeIds.has(badge.id)) return;
        let conditionMet = false;

        if (badge.id === 'first_step' && totalMastered >= 1) conditionMet = true;
        if (badge.id === 'novice_scholar' && totalMastered >= 5) conditionMet = true;
        if (badge.id === 'elite_student' && totalMastered >= 15) conditionMet = true;
        if (badge.id === 'board_ready' && totalMastered >= 30) conditionMet = true;
        if (badge.id === 'curriculum_conqueror' && totalMastered >= 60) conditionMet = true;
        if (badge.id === 'revision_pro' && totalRevisions >= 10) conditionMet = true;
        if (badge.id === 'revision_king' && totalRevisions >= 50) conditionMet = true;
        if (badge.id === 'flawless_recall' && totalRevisions >= 100) conditionMet = true;
        if (badge.id === 'streak_3' && stats.streak >= 3) conditionMet = true;
        if (badge.id === 'streak_7' && stats.streak >= 7) conditionMet = true;
        if (badge.id === 'streak_30' && stats.streak >= 30) conditionMet = true;
        if (badge.id === 'streak_100' && stats.streak >= 100) conditionMet = true;
        if (badge.id === 'xp_1000' && stats.xp >= 1000) conditionMet = true;
        if (badge.id === 'xp_5000' && stats.xp >= 5000) conditionMet = true;
        if (badge.id === 'xp_20000' && stats.xp >= 20000) conditionMet = true;
        if (badge.id === 'early_bird' && currentHour < 7 && stats.dailyWorkLog[today]) conditionMet = true;
        if (badge.id === 'night_owl' && currentHour >= 22 && stats.dailyWorkLog[today]) conditionMet = true;

        const subMastery = (id: SubjectId) => subjects.find(s => s.id === id)?.chapters.filter(c => c.status === ChapterStatus.MASTERED).length || 0;
        if (badge.id === 'math_wizard' && subMastery('math') >= 8) conditionMet = true;
        if (badge.id === 'science_guru' && subMastery('science') >= 8) conditionMet = true;
        if (badge.id === 'social_legend' && subMastery('sst') >= 8) conditionMet = true;
        if (badge.id === 'polyglot' && (subMastery('english') + subMastery('sanskrit')) >= 5) conditionMet = true;
        if (badge.id === 'all_rounder' && subjects.every(s => s.chapters.filter(c => c.status === ChapterStatus.MASTERED).length >= 2)) conditionMet = true;

        if (conditionMet) {
          newlyFoundIds.push(badge.id);
          bonusXp += badge.points;
          setNewlyUnlockedBadge(badge);
          setTimeout(() => setNewlyUnlockedBadge(null), 5000);
        }
      });

      if (newlyFoundIds.length > 0) {
        setStats(prev => ({
          ...prev,
          badges: [...prev.badges, ...newlyFoundIds],
          xp: prev.xp + bonusXp,
          level: calculateLevel(prev.xp + bonusXp)
        }));
      }
    };
    checkBadges();
  }, [subjects, stats.streak, stats.xp]);

  const fetchAdvice = async () => {
    if (navigator.onLine) {
      setIsCoachLoading(true);
      const advice = await getCoachAdvice(subjects, stats);
      setCoachMessage(advice);
      setIsCoachLoading(false);
    } else {
      const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
      setCoachMessage(`(Offline) ${randomQuote}`);
    }
  };

  const updateStatsAndWorkLog = (xpGain: number, masteredCountDelta: number, revisedCountDelta: number) => {
    const today = getDateKey();
    const currentHour = new Date().getHours();
    
    setStats(prev => {
      const newXp = Math.max(0, prev.xp + xpGain);
      const newLevel = calculateLevel(newXp);
      let newStreak = prev.streak;
      if (prev.lastActivityDate !== today) {
        if (!prev.lastActivityDate || isYesterdayOf(prev.lastActivityDate, today)) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      }
      const logEntry = prev.dailyWorkLog[today] || { mastered: 0, revised: 0, xpEarned: 0, studyHours: [] };
      const updatedHours = [...(logEntry.studyHours || [])];
      if (!updatedHours.includes(currentHour)) updatedHours.push(currentHour);
      const updatedLog = {
        ...prev.dailyWorkLog,
        [today]: {
          mastered: Math.max(0, logEntry.mastered + masteredCountDelta),
          revised: Math.max(0, logEntry.revised + revisedCountDelta),
          xpEarned: Math.max(0, logEntry.xpEarned + xpGain),
          studyHours: updatedHours
        }
      };
      return { ...prev, xp: newXp, level: newLevel, streak: newStreak, lastActivityDate: today, dailyWorkLog: updatedLog };
    });
  };

  const updateChapter = (subjectId: SubjectId, chapterId: string, updates: Partial<any>) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        chapters: s.chapters.map(c => {
          if (c.id !== chapterId) return c;
          let xpGain = 0; let masteredDelta = 0; let revisedDelta = 0;
          if (updates.status !== undefined && updates.status !== c.status) {
            if (updates.status === ChapterStatus.MASTERED) { xpGain += 100; masteredDelta = 1; }
            else if (c.status === ChapterStatus.MASTERED) { xpGain -= 100; masteredDelta = -1; }
          }
          if (updates.revisionCount !== undefined && updates.revisionCount !== c.revisionCount) {
            const diff = updates.revisionCount - c.revisionCount;
            if (diff > 0) xpGain += diff * 25;
            revisedDelta = diff;
          }
          if (xpGain !== 0 || masteredDelta !== 0 || revisedDelta !== 0) updateStatsAndWorkLog(xpGain, masteredDelta, revisedDelta);
          return { ...c, ...updates };
        })
      };
    }));
  };

  const currentSubject = subjects.find(s => s.id === selectedSubjectId)!;
  const overallProgress = useMemo(() => {
    const totalChapters = subjects.reduce((acc, s) => acc + s.chapters.length, 0);
    const masteredChapters = subjects.reduce((acc, s) => acc + s.chapters.filter(c => c.status === ChapterStatus.MASTERED).length, 0);
    return (masteredChapters / totalChapters) * 100;
  }, [subjects]);

  const examReadiness = useMemo(() => {
    const completionWeight = overallProgress * 0.7;
    const revisionSum = subjects.reduce((acc, s) => acc + s.chapters.reduce((a, c) => a + c.revisionCount, 0), 0);
    const revisionAvg = revisionSum / 30; 
    return Math.min(100, Math.round(completionWeight + Math.min(30, revisionAvg * 2)));
  }, [overallProgress, subjects]);

  const difficultFocusChapters = useMemo(() => {
    const list: { subName: string, chapter: Chapter, color: string, subId: SubjectId }[] = [];
    subjects.forEach(s => {
      s.chapters.forEach(c => {
        if (c.difficulty >= 4 && c.status !== ChapterStatus.MASTERED) {
          list.push({ subName: s.name, chapter: c, color: s.color, subId: s.id });
        }
      });
    });
    return list.sort((a, b) => b.chapter.difficulty - a.chapter.difficulty).slice(0, 3);
  }, [subjects]);

  const countdownDays = useMemo(() => {
    const examDate = new Date(stats.examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = examDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  }, [stats.examDate]);

  const last7DaysLog = useMemo(() => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getDateKey(d);
      dates.push({
        date: key,
        display: d.toLocaleDateString('en-US', { weekday: 'short' }),
        work: stats.dailyWorkLog[key] || { mastered: 0, revised: 0, xpEarned: 0 }
      });
    }
    return dates;
  }, [stats.dailyWorkLog]);

  return (
    <div className={`min-h-screen flex flex-col md:flex-row text-gray-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 select-none transition-colors duration-300`}>
      {newlyUnlockedBadge && (
        <div className="fixed top-6 right-6 z-[100] bg-indigo-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-500 border border-indigo-700">
          <div className="text-3xl">{newlyUnlockedBadge.icon}</div>
          <div>
            <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">New Badge Unlocked!</p>
            <h4 className="font-bold text-lg">{newlyUnlockedBadge.name}</h4>
            <p className="text-xs text-indigo-100 opacity-80">+{newlyUnlockedBadge.points} XP</p>
          </div>
        </div>
      )}

      {activeNudge && (
        <div className="fixed bottom-24 md:bottom-8 right-6 z-[90] flex items-end gap-3 animate-in slide-in-from-bottom duration-500 max-w-[280px]">
          <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-br-none shadow-2xl border border-indigo-100 dark:border-indigo-900 relative">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed">{activeNudge}</p>
            <div className="absolute top-1 right-2 text-[10px] text-indigo-400 font-bold opacity-50">COACH</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-700 flex items-center justify-center text-xl shadow-lg shrink-0">🎓</div>
        </div>
      )}

      <aside className="hidden md:flex flex-col w-64 bg-indigo-900 text-white p-6 sticky top-0 h-screen shadow-2xl z-40">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-white p-2 rounded-xl text-indigo-900 font-bold text-xl">10</div>
          <h1 className="font-bold text-lg leading-tight tracking-tight">CBSE Coach</h1>
        </div>
        <nav className="flex flex-col gap-2 flex-grow">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-700 shadow-lg' : 'hover:bg-indigo-800'}`}>📊 Dashboard</button>
          <button onClick={() => setActiveTab('subjects')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'subjects' ? 'bg-indigo-700 shadow-lg' : 'hover:bg-indigo-800'}`}>📚 Subjects</button>
          <button onClick={() => setActiveTab('analysis')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'analysis' ? 'bg-indigo-700 shadow-lg' : 'hover:bg-indigo-800'}`}>🏆 Rewards</button>
        </nav>
        <div className="mt-auto pt-6 border-t border-indigo-800">
          <button onClick={() => setDarkMode(!darkMode)} className="flex items-center gap-3 w-full px-4 py-3 mb-4 rounded-xl hover:bg-indigo-800 transition-colors">
            <span className="text-xl">{darkMode ? '☀️' : '🌙'}</span>
            <span className="font-bold text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-400 border-2 border-white flex items-center justify-center text-xl shadow-inner">🎓</div>
            <div>
              <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Rank: Scholar</p>
              <div className="w-24 h-1.5 bg-indigo-800 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-yellow-400" style={{ width: `${(stats.xp % 500) / 5}%` }}></div>
              </div>
              <p className="text-[10px] text-indigo-200 mt-1">Lvl {stats.level} • {stats.xp} XP</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 transition-colors duration-300">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Namaste! 👋</h2>
            <p className="text-slate-500 dark:text-slate-400">Track your path to the merit list.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className="md:hidden w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-800 shadow-sm">
              {darkMode ? '☀️' : '🌙'}
            </button>
            <div className="bg-orange-100 dark:bg-orange-950/30 px-4 py-2 rounded-2xl flex items-center gap-3 border border-orange-200 dark:border-orange-900 shadow-sm">
              <span className="text-2xl animate-bounce">🔥</span>
              <div>
                <p className="text-[10px] text-orange-600 dark:text-orange-400 font-black uppercase tracking-widest leading-none">Streak</p>
                <p className="font-bold text-orange-900 dark:text-orange-100 leading-tight">{stats.streak} Days</p>
              </div>
            </div>
            <div className="bg-indigo-100 dark:bg-indigo-950/30 px-4 py-2 rounded-2xl flex items-center gap-3 border border-indigo-200 dark:border-indigo-900 shadow-sm relative group">
              <span className="text-2xl">📅</span>
              <div>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest leading-none">Exam Goal</p>
                <p className="font-bold text-indigo-900 dark:text-indigo-100 leading-tight">{countdownDays} Days Left</p>
              </div>
              <button onClick={() => setIsEditingExamDate(!isEditingExamDate)} className="absolute -top-1 -right-1 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-full p-1 border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">✏️</button>
            </div>
          </div>
        </header>

        {isEditingExamDate && (
          <Card className="mb-8 border-2 border-indigo-200 dark:border-indigo-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-indigo-900 dark:text-indigo-400">Update Board Exam Date</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Keep the pressure just right!</p>
              </div>
              <div className="flex gap-2">
                <input type="date" value={stats.examDate} onChange={(e) => setStats(prev => ({ ...prev, examDate: e.target.value }))} className="border dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500" />
                <button onClick={() => setIsEditingExamDate(false)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Save</button>
              </div>
            </div>
          </Card>
        )}

        <Card className="mb-8 border-l-4 border-l-indigo-500 bg-gradient-to-r from-white to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/20" onClick={fetchAdvice}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shrink-0 ${isCoachLoading ? 'bg-indigo-400 animate-pulse' : 'bg-indigo-600'}`}>
              {isCoachLoading ? '🌀' : '💡'}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-indigo-900 dark:text-indigo-400">Study Coach Advice</h3>
                {isOffline && <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold">Offline</span>}
              </div>
              <p className={`text-slate-700 dark:text-slate-200 italic leading-relaxed text-sm ${isCoachLoading ? 'opacity-50' : ''}`}>"{coachMessage}"</p>
            </div>
          </div>
        </Card>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <Card className="md:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Mastery Checklist</h3>
                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 rounded-full uppercase tracking-widest">Live Auto-Tagging</span>
              </div>
              <div className="space-y-6">
                {subjects.map(s => {
                  const masteredCount = s.chapters.filter(c => c.status === ChapterStatus.MASTERED).length;
                  const percent = (masteredCount / s.chapters.length) * 100;
                  return (
                    <div key={s.id}>
                      <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{s.icon}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{s.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{masteredCount}/{s.chapters.length} DONE</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${s.color}`} style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {difficultFocusChapters.length > 0 && (
                <div className="mt-10 pt-6 border-t dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-rose-500">🔥</span>
                    <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-widest">Priority Focus: Difficult Chapters</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {difficultFocusChapters.map((item, i) => (
                      <div key={i} onClick={() => { setSelectedSubjectId(item.subId); setActiveTab('subjects'); }} className="bg-rose-50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/50 cursor-pointer hover:scale-[1.02] transition-transform">
                        <p className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase truncate">{item.subName}</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-2 mt-1">{item.chapter.title}</p>
                        <div className="mt-2 flex items-center gap-1"><span className="text-[10px] font-black text-rose-500">TAG: HARD</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            <div className="space-y-6">
              <Card className="flex flex-col items-center text-center">
                <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Exam Readiness</h3>
                <ProgressCircle percentage={examReadiness} color="text-indigo-600" size="lg" />
                <p className="mt-4 text-[10px] font-bold text-slate-400 px-4">Based on Syllabus Completion & Revision Depth</p>
              </Card>
              <Card>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Best Badges</h3>
                  <button onClick={() => setActiveTab('analysis')} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline">View All</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stats.badges.length === 0 ? <p className="text-xs text-slate-400 italic">No badges earned. Study now!</p> : (
                    stats.badges.slice(-5).reverse().map(bid => {
                      const b = BADGES.find(x => x.id === bid);
                      return b ? <BadgeIcon key={bid} badge={b} isUnlocked={true} /> : null;
                    })
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {subjects.map(s => (
                <button key={s.id} onClick={() => setSelectedSubjectId(s.id)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl whitespace-nowrap transition-all ${selectedSubjectId === s.id ? `${s.color} text-white shadow-xl scale-105` : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 border border-transparent dark:border-slate-800'}`}>
                  <span className="text-xl">{s.icon}</span>
                  <span className="font-bold">{s.name}</span>
                </button>
              ))}
            </div>
            <Card className="p-0 overflow-hidden border-2 border-slate-100 dark:border-slate-800">
              <div className="p-6 flex items-center justify-between border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg ${currentSubject.color}`}>{currentSubject.icon}</div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{currentSubject.name}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{currentSubject.chapters.length} Lessons</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentSubject.chapters.map(ch => {
                  const diffInfo = getDifficultyInfo(ch.difficulty);
                  return (
                    <div key={ch.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm ${ch.status === ChapterStatus.MASTERED ? 'bg-green-500' : ch.status === ChapterStatus.REVISED ? 'bg-blue-500' : ch.status === ChapterStatus.IN_PROGRESS ? 'bg-yellow-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                          {ch.id.replace(/^\D+/g, '')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">{ch.title}</h4>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 ${diffInfo.color}`}>{diffInfo.icon} {diffInfo.label}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-full uppercase">{ch.category || 'Core'}</span>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{ch.revisionCount} Revisions</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={ch.status} onChange={(e) => updateChapter(currentSubject.id, ch.id, { status: e.target.value as ChapterStatus })} className="text-xs font-bold border dark:border-slate-700 rounded-xl px-3 py-2 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500">
                          {Object.values(ChapterStatus).map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border dark:border-slate-700">
                          <button onClick={() => updateChapter(currentSubject.id, ch.id, { revisionCount: Math.max(0, ch.revisionCount - 1) })} className="px-3 py-2 hover:bg-red-100 dark:hover:bg-red-950/30 text-red-500 font-bold">-</button>
                          <span className="px-2 text-[10px] font-black text-slate-500 dark:text-slate-400">REV</span>
                          <button onClick={() => updateChapter(currentSubject.id, ch.id, { revisionCount: ch.revisionCount + 1 })} className="px-3 py-2 hover:bg-green-100 dark:hover:bg-green-950/30 text-green-500 font-bold">+</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white border-none shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div>
                  <h3 className="text-2xl font-black mb-2 tracking-tight">Hall of Achievements</h3>
                  <p className="text-indigo-200 text-sm max-w-md opacity-80">Earn tiered badges to level up your profile.</p>
                  <div className="flex gap-4 mt-6">
                    <div className="text-center"><p className="text-3xl font-black">{stats.badges.length}</p><p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold">Earned</p></div>
                    <div className="text-center border-l border-indigo-700 pl-4"><p className="text-3xl font-black">{BADGES.length - stats.badges.length}</p><p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold">Locked</p></div>
                  </div>
                </div>
                <div className="bg-white/10 p-6 rounded-3xl backdrop-blur-sm border border-white/10 w-full md:w-auto text-center">
                  <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-black mb-2">Completion Progress</p>
                  <div className="text-4xl font-black">{Math.round((stats.badges.length / BADGES.length) * 100)}%</div>
                  <div className="w-48 h-2 bg-indigo-950 rounded-full mt-4 overflow-hidden mx-auto"><div className="h-full bg-yellow-400" style={{ width: `${(stats.badges.length / BADGES.length) * 100}%` }}></div></div>
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {['Common', 'Rare', 'Epic', 'Legendary'].map(rarity => (
                <Card key={rarity} className="p-4 flex flex-col items-center justify-center border-t-4 border-t-indigo-500 dark:border-t-indigo-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{rarity}</p>
                  <p className="text-xl font-black text-slate-800 dark:text-slate-100">{stats.badges.filter(id => BADGES.find(b => b.id === id)?.rarity === rarity).length} / {BADGES.filter(b => b.rarity === rarity).length}</p>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {BADGES.map(b => {
                const isUnlocked = stats.badges.includes(b.id);
                return (
                  <div key={b.id} className="group relative flex flex-col items-center">
                    <BadgeIcon badge={b} isUnlocked={isUnlocked} />
                    <p className={`mt-3 text-xs font-black text-center ${isUnlocked ? 'text-slate-800 dark:text-slate-200' : 'text-slate-300 dark:text-slate-700'}`}>{b.name}</p>
                    <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-48 bg-slate-800 text-white text-[10px] p-3 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all z-50 pointer-events-none border border-slate-700">
                      <p className="font-bold text-indigo-300 mb-1">{b.name} ({b.rarity})</p>
                      <p className="opacity-80 leading-relaxed">{b.description}</p>
                      <p className="mt-2 text-yellow-400 font-bold uppercase tracking-widest">+{b.points} XP reward</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around p-3 z-50 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-colors duration-300">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 flex-1 py-1 transition-colors ${activeTab === 'dashboard' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
          <span className="text-xl">📊</span><span className="text-[10px] font-bold uppercase">Stats</span>
        </button>
        <button onClick={() => setActiveTab('subjects')} className={`flex flex-col items-center gap-1 flex-1 py-1 transition-colors ${activeTab === 'subjects' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
          <span className="text-xl">📚</span><span className="text-[10px] font-bold uppercase">Subs</span>
        </button>
        <button onClick={() => setActiveTab('analysis')} className={`flex flex-col items-center gap-1 flex-1 py-1 transition-colors ${activeTab === 'analysis' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
          <span className="text-xl">🏆</span><span className="text-[10px] font-bold uppercase">Badges</span>
        </button>
      </nav>
    </div>
  );
}
