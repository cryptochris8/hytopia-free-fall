import { PlayerEntity, World, Entity, Vector3Like, RigidBodyType, ColliderShape, Player } from 'hytopia';
import { MathTopic } from './CurriculumSystem';

/**
 * Achievement Type Enumeration
 */
export enum AchievementType {
  SPEED_DEMON = "speed_demon",
  PERFECTIONIST = "perfectionist",
  STREAK_MASTER = "streak_master",
  TOPIC_EXPERT = "topic_expert",
  EARLY_BIRD = "early_bird",
  NIGHT_OWL = "night_owl",
  PERSISTENT = "persistent",
  QUICK_LEARNER = "quick_learner",
  COMEBACK_KID = "comeback_kid",
  EXPLORER = "explorer",
  MARATHON_RUNNER = "marathon_runner",
  ACCURACY_CHAMPION = "accuracy_champion"
}

/**
 * Achievement Rarity Levels
 */
export enum AchievementRarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary"
}

/**
 * Achievement Definition Interface
 */
export interface Achievement {
  id: AchievementType;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  points: number;
  requirements: AchievementRequirement[];
  category: string;
  isRepeatable: boolean;
  maxTiers?: number;
  currentTier?: number;
}

/**
 * Achievement Requirement Interface
 */
export interface AchievementRequirement {
  type: 'streak' | 'accuracy' | 'speed' | 'count' | 'time' | 'topic' | 'session';
  value: number;
  comparison: 'equals' | 'greater' | 'less' | 'greaterOrEqual' | 'lessOrEqual';
  topic?: MathTopic;
  timeframe?: 'session' | 'day' | 'week' | 'month' | 'allTime';
}

/**
 * Player Achievement Progress Interface
 */
export interface PlayerAchievementProgress {
  playerId: string;
  unlockedAchievements: Set<AchievementType>;
  achievementProgress: Map<AchievementType, AchievementProgress>;
  totalPoints: number;
  currentStreak: number;
  bestStreak: number;
  sessionStats: SessionStats;
  dailyStats: DailyStats;
  weeklyStats: WeeklyStats;
  allTimeStats: AllTimeStats;
}

/**
 * Achievement Progress Interface
 */
export interface AchievementProgress {
  achievementId: AchievementType;
  progress: number;
  maxProgress: number;
  isUnlocked: boolean;
  unlockedDate?: Date;
  currentTier: number;
  notificationShown: boolean;
}

/**
 * Session Statistics Interface
 */
export interface SessionStats {
  questionsAnswered: number;
  correctAnswers: number;
  currentStreak: number;
  averageResponseTime: number;
  topicsEngaged: Set<MathTopic>;
  sessionStartTime: Date;
  sessionDuration: number;
  perfectAnswers: number;
}

/**
 * Daily Statistics Interface
 */
export interface DailyStats {
  date: string;
  questionsAnswered: number;
  correctAnswers: number;
  bestStreak: number;
  totalPlayTime: number;
  topicsEngaged: Set<MathTopic>;
  sessionsPlayed: number;
}

/**
 * Weekly Statistics Interface
 */
export interface WeeklyStats {
  week: string;
  questionsAnswered: number;
  correctAnswers: number;
  bestStreak: number;
  totalPlayTime: number;
  topicsEngaged: Set<MathTopic>;
  sessionsPlayed: number;
  consistencyDays: number;
}

/**
 * All Time Statistics Interface
 */
export interface AllTimeStats {
  totalQuestionsAnswered: number;
  totalCorrectAnswers: number;
  bestStreak: number;
  totalPlayTime: number;
  topicsEngaged: Set<MathTopic>;
  totalSessions: number;
  firstPlayDate: Date;
  lastPlayDate: Date;
}

/**
 * Achievement Notification Interface
 */
export interface AchievementNotification {
  achievement: Achievement;
  playerId: string;
  unlockedDate: Date;
  isNewTier: boolean;
  previousTier?: number;
  currentTier: number;
}

/**
 * Achievement System - Manages player achievements and progress tracking
 */
export class AchievementSystem {
  private static _instance: AchievementSystem;
  private _world: World | null = null;
  private _achievements: Map<AchievementType, Achievement> = new Map();
  private _playerProgress: Map<string, PlayerAchievementProgress> = new Map();
  private _pendingNotifications: Map<string, AchievementNotification[]> = new Map();
  private _achievementCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this._initializeAchievements();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): AchievementSystem {
    if (!AchievementSystem._instance) {
      AchievementSystem._instance = new AchievementSystem();
    }
    return AchievementSystem._instance;
  }

  /**
   * Initialize the achievement system
   */
  public initialize(world: World): void {
    try {
      if (!world) {
        throw new Error('World instance is required');
      }
      this._world = world;
      this._startAchievementChecks();
      console.log('[AchievementSystem] Initialized achievement system');
    } catch (error) {
      console.error('[AchievementSystem] Failed to initialize:', error);
      throw error; // Re-throw to let caller handle critical failure
    }
  }

  /**
   * Save player achievement progress to Hytopia persistence
   */
  private async _savePlayerAchievements(player: Player, progress: PlayerAchievementProgress): Promise<void> {
    try {
      const persistedData = await player.getPersistedData();
      const achievementData = {
        unlockedAchievements: Array.from(progress.unlockedAchievements),
        totalPoints: progress.totalPoints,
        currentStreak: progress.currentStreak,
        bestStreak: progress.bestStreak,
        allTimeStats: {
          ...progress.allTimeStats,
          topicsEngaged: Array.from(progress.allTimeStats.topicsEngaged),
          firstPlayDate: progress.allTimeStats.firstPlayDate.toISOString(),
          lastPlayDate: progress.allTimeStats.lastPlayDate.toISOString()
        },
        achievementProgress: Array.from(progress.achievementProgress.entries()).map(([id, prog]) => ({
          achievementId: id,
          progress: prog.progress,
          maxProgress: prog.maxProgress,
          isUnlocked: prog.isUnlocked,
          unlockedDate: prog.unlockedDate?.toISOString(),
          currentTier: prog.currentTier,
          notificationShown: prog.notificationShown
        }))
      };

      const updatedData = {
        ...persistedData,
        achievements: achievementData
      };

      await player.setPersistedData(updatedData);
      console.log(`[AchievementSystem] Saved achievement data for player ${player.id}`);
    } catch (error) {
      console.error(`[AchievementSystem] Failed to save achievement data for player ${player.id}:`, error);
    }
  }

  /**
   * Load player achievement progress from Hytopia persistence
   */
  private async _loadPlayerAchievements(player: Player): Promise<PlayerAchievementProgress | null> {
    try {
      const persistedData = await player.getPersistedData();
      const achievementData = persistedData?.achievements;
      
      if (!achievementData) {
        return null;
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const thisWeek = this._getWeekString(now);

      const progress: PlayerAchievementProgress = {
        playerId: player.id,
        unlockedAchievements: new Set(achievementData.unlockedAchievements || []),
        achievementProgress: new Map(),
        totalPoints: achievementData.totalPoints || 0,
        currentStreak: achievementData.currentStreak || 0,
        bestStreak: achievementData.bestStreak || 0,
        sessionStats: {
          questionsAnswered: 0,
          correctAnswers: 0,
          currentStreak: 0,
          averageResponseTime: 0,
          topicsEngaged: new Set(),
          sessionStartTime: now,
          sessionDuration: 0,
          perfectAnswers: 0
        },
        dailyStats: {
          date: today,
          questionsAnswered: 0,
          correctAnswers: 0,
          bestStreak: 0,
          totalPlayTime: 0,
          topicsEngaged: new Set(),
          sessionsPlayed: 0
        },
        weeklyStats: {
          week: thisWeek,
          questionsAnswered: 0,
          correctAnswers: 0,
          bestStreak: 0,
          totalPlayTime: 0,
          topicsEngaged: new Set(),
          sessionsPlayed: 0,
          consistencyDays: 0
        },
        allTimeStats: {
          totalQuestionsAnswered: achievementData.allTimeStats?.totalQuestionsAnswered || 0,
          totalCorrectAnswers: achievementData.allTimeStats?.totalCorrectAnswers || 0,
          bestStreak: achievementData.allTimeStats?.bestStreak || 0,
          totalPlayTime: achievementData.allTimeStats?.totalPlayTime || 0,
          topicsEngaged: new Set(achievementData.allTimeStats?.topicsEngaged || []),
          totalSessions: achievementData.allTimeStats?.totalSessions || 0,
          firstPlayDate: achievementData.allTimeStats?.firstPlayDate ? 
            new Date(achievementData.allTimeStats.firstPlayDate) : now,
          lastPlayDate: achievementData.allTimeStats?.lastPlayDate ? 
            new Date(achievementData.allTimeStats.lastPlayDate) : now
        }
      };

      // Restore achievement progress
      if (achievementData.achievementProgress) {
        achievementData.achievementProgress.forEach((prog: any) => {
          const achievementProgress: AchievementProgress = {
            achievementId: prog.achievementId,
            progress: prog.progress || 0,
            maxProgress: prog.maxProgress || 0,
            isUnlocked: prog.isUnlocked || false,
            unlockedDate: prog.unlockedDate ? new Date(prog.unlockedDate) : undefined,
            currentTier: prog.currentTier || 0,
            notificationShown: prog.notificationShown || false
          };
          progress.achievementProgress.set(prog.achievementId, achievementProgress);
        });
      }

      console.log(`[AchievementSystem] Loaded achievement data for player ${player.id}`);
      return progress;
    } catch (error) {
      console.error(`[AchievementSystem] Failed to load achievement data for player ${player.id}:`, error);
      return null;
    }
  }

  /**
   * Initialize achievement definitions
   */
  private _initializeAchievements(): void {
    const achievements: Achievement[] = [
      {
        id: AchievementType.SPEED_DEMON,
        name: "Speed Demon",
        description: "Answer 5 questions in under 30 seconds",
        icon: "⚡",
        rarity: AchievementRarity.UNCOMMON,
        points: 100,
        requirements: [
          { type: 'count', value: 5, comparison: 'greaterOrEqual', timeframe: 'session' },
          { type: 'time', value: 30000, comparison: 'less', timeframe: 'session' }
        ],
        category: "Speed",
        isRepeatable: true,
        maxTiers: 5
      },
      {
        id: AchievementType.PERFECTIONIST,
        name: "Perfectionist",
        description: "Complete a round with no wrong answers",
        icon: "🎯",
        rarity: AchievementRarity.RARE,
        points: 150,
        requirements: [
          { type: 'count', value: 10, comparison: 'greaterOrEqual', timeframe: 'session' },
          { type: 'accuracy', value: 1.0, comparison: 'equals', timeframe: 'session' }
        ],
        category: "Accuracy",
        isRepeatable: true,
        maxTiers: 3
      },
      {
        id: AchievementType.STREAK_MASTER,
        name: "Streak Master",
        description: "Achieve 20 consecutive correct answers",
        icon: "🔥",
        rarity: AchievementRarity.EPIC,
        points: 200,
        requirements: [
          { type: 'streak', value: 20, comparison: 'greaterOrEqual', timeframe: 'allTime' }
        ],
        category: "Consistency",
        isRepeatable: true,
        maxTiers: 10
      },
      {
        id: AchievementType.TOPIC_EXPERT,
        name: "Topic Expert",
        description: "Master a math topic with 95% accuracy",
        icon: "🎓",
        rarity: AchievementRarity.RARE,
        points: 175,
        requirements: [
          { type: 'accuracy', value: 0.95, comparison: 'greaterOrEqual', timeframe: 'allTime' },
          { type: 'count', value: 50, comparison: 'greaterOrEqual', timeframe: 'allTime' }
        ],
        category: "Mastery",
        isRepeatable: true,
        maxTiers: 6
      },
      {
        id: AchievementType.EARLY_BIRD,
        name: "Early Bird",
        description: "Play before 8 AM",
        icon: "🌅",
        rarity: AchievementRarity.COMMON,
        points: 50,
        requirements: [
          { type: 'time', value: 8, comparison: 'less', timeframe: 'session' }
        ],
        category: "Timing",
        isRepeatable: true,
        maxTiers: 7
      },
      {
        id: AchievementType.NIGHT_OWL,
        name: "Night Owl",
        description: "Play after 10 PM",
        icon: "🦉",
        rarity: AchievementRarity.COMMON,
        points: 50,
        requirements: [
          { type: 'time', value: 22, comparison: 'greater', timeframe: 'session' }
        ],
        category: "Timing",
        isRepeatable: true,
        maxTiers: 7
      },
      {
        id: AchievementType.PERSISTENT,
        name: "Persistent",
        description: "Play for 7 consecutive days",
        icon: "📅",
        rarity: AchievementRarity.EPIC,
        points: 300,
        requirements: [
          { type: 'count', value: 7, comparison: 'greaterOrEqual', timeframe: 'week' }
        ],
        category: "Dedication",
        isRepeatable: true,
        maxTiers: 4
      },
      {
        id: AchievementType.QUICK_LEARNER,
        name: "Quick Learner",
        description: "Improve accuracy by 20% in one session",
        icon: "🧠",
        rarity: AchievementRarity.RARE,
        points: 125,
        requirements: [
          { type: 'accuracy', value: 0.2, comparison: 'greaterOrEqual', timeframe: 'session' }
        ],
        category: "Improvement",
        isRepeatable: true,
        maxTiers: 5
      },
      {
        id: AchievementType.COMEBACK_KID,
        name: "Comeback Kid",
        description: "Get 10 correct answers after 3 wrong ones",
        icon: "💪",
        rarity: AchievementRarity.UNCOMMON,
        points: 100,
        requirements: [
          { type: 'streak', value: 10, comparison: 'greaterOrEqual', timeframe: 'session' }
        ],
        category: "Resilience",
        isRepeatable: true,
        maxTiers: 3
      },
      {
        id: AchievementType.EXPLORER,
        name: "Explorer",
        description: "Try all available math topics",
        icon: "🗺️",
        rarity: AchievementRarity.LEGENDARY,
        points: 500,
        requirements: [
          { type: 'count', value: 6, comparison: 'greaterOrEqual', timeframe: 'allTime' }
        ],
        category: "Exploration",
        isRepeatable: false
      },
      {
        id: AchievementType.MARATHON_RUNNER,
        name: "Marathon Runner",
        description: "Play for 60 minutes in one session",
        icon: "🏃",
        rarity: AchievementRarity.EPIC,
        points: 250,
        requirements: [
          { type: 'time', value: 3600000, comparison: 'greaterOrEqual', timeframe: 'session' }
        ],
        category: "Endurance",
        isRepeatable: true,
        maxTiers: 3
      },
      {
        id: AchievementType.ACCURACY_CHAMPION,
        name: "Accuracy Champion",
        description: "Maintain 90% accuracy over 100 questions",
        icon: "🏆",
        rarity: AchievementRarity.LEGENDARY,
        points: 1000,
        requirements: [
          { type: 'accuracy', value: 0.9, comparison: 'greaterOrEqual', timeframe: 'allTime' },
          { type: 'count', value: 100, comparison: 'greaterOrEqual', timeframe: 'allTime' }
        ],
        category: "Excellence",
        isRepeatable: true,
        maxTiers: 5
      }
    ];

    // Store achievements in map
    achievements.forEach(achievement => {
      this._achievements.set(achievement.id, achievement);
    });

    console.log(`[AchievementSystem] Initialized ${achievements.length} achievements`);
  }

  /**
   * Start achievement checking
   */
  private _startAchievementChecks(): void {
    if (this._achievementCheckInterval) {
      clearInterval(this._achievementCheckInterval);
    }

    this._achievementCheckInterval = setInterval(() => {
      this._checkAllPlayerAchievements();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Initialize player progress with persistence support
   */
  public async initializePlayerProgress(player: Player): Promise<void> {
    if (this._playerProgress.has(player.id)) return;

    // Try to load existing progress first
    const loadedProgress = await this._loadPlayerAchievements(player);
    
    if (loadedProgress) {
      // Fill in any missing achievement progress for new achievements
      this._achievements.forEach((achievement, id) => {
        if (!loadedProgress.achievementProgress.has(id)) {
          const achievementProgress: AchievementProgress = {
            achievementId: id,
            progress: 0,
            maxProgress: achievement.requirements[0].value,
            isUnlocked: false,
            currentTier: 0,
            notificationShown: false
          };
          loadedProgress.achievementProgress.set(id, achievementProgress);
        }
      });
      
      this._playerProgress.set(player.id, loadedProgress);
      console.log(`[AchievementSystem] Loaded existing progress for player ${player.id}`);
      return;
    }

    // Create new progress if none exists
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisWeek = this._getWeekString(now);

    const progress: PlayerAchievementProgress = {
      playerId: player.id,
      unlockedAchievements: new Set(),
      achievementProgress: new Map(),
      totalPoints: 0,
      currentStreak: 0,
      bestStreak: 0,
      sessionStats: {
        questionsAnswered: 0,
        correctAnswers: 0,
        currentStreak: 0,
        averageResponseTime: 0,
        topicsEngaged: new Set(),
        sessionStartTime: now,
        sessionDuration: 0,
        perfectAnswers: 0
      },
      dailyStats: {
        date: today,
        questionsAnswered: 0,
        correctAnswers: 0,
        bestStreak: 0,
        totalPlayTime: 0,
        topicsEngaged: new Set(),
        sessionsPlayed: 0
      },
      weeklyStats: {
        week: thisWeek,
        questionsAnswered: 0,
        correctAnswers: 0,
        bestStreak: 0,
        totalPlayTime: 0,
        topicsEngaged: new Set(),
        sessionsPlayed: 0,
        consistencyDays: 0
      },
      allTimeStats: {
        totalQuestionsAnswered: 0,
        totalCorrectAnswers: 0,
        bestStreak: 0,
        totalPlayTime: 0,
        topicsEngaged: new Set(),
        totalSessions: 0,
        firstPlayDate: now,
        lastPlayDate: now
      }
    };

    // Initialize achievement progress
    this._achievements.forEach((achievement, id) => {
      const achievementProgress: AchievementProgress = {
        achievementId: id,
        progress: 0,
        maxProgress: achievement.requirements[0].value,
        isUnlocked: false,
        currentTier: 0,
        notificationShown: false
      };
      progress.achievementProgress.set(id, achievementProgress);
    });

    this._playerProgress.set(player.id, progress);
    
    // Save initial progress
    await this._savePlayerAchievements(player, progress);
    console.log(`[AchievementSystem] Initialized new progress for player ${player.id}`);
  }

  /**
   * Record player action with automatic persistence
   */
  public async recordAction(
    player: Player,
    action: 'question_answered' | 'correct_answer' | 'wrong_answer' | 'session_start' | 'session_end',
    data?: { topic?: MathTopic; responseTime?: number; accuracy?: number }
  ): Promise<void> {
    const progress = this._playerProgress.get(player.id);
    if (!progress) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisWeek = this._getWeekString(now);

    // Update stats based on action
    switch (action) {
      case 'question_answered':
        progress.sessionStats.questionsAnswered++;
        progress.dailyStats.questionsAnswered++;
        progress.weeklyStats.questionsAnswered++;
        progress.allTimeStats.totalQuestionsAnswered++;
        progress.allTimeStats.lastPlayDate = now;
        
        if (data?.topic) {
          progress.sessionStats.topicsEngaged.add(data.topic);
          progress.dailyStats.topicsEngaged.add(data.topic);
          progress.weeklyStats.topicsEngaged.add(data.topic);
          progress.allTimeStats.topicsEngaged.add(data.topic);
        }
        
        if (data?.responseTime) {
          const currentAvg = progress.sessionStats.averageResponseTime;
          const count = progress.sessionStats.questionsAnswered;
          progress.sessionStats.averageResponseTime = (currentAvg * (count - 1) + data.responseTime) / count;
        }
        break;

      case 'correct_answer':
        progress.sessionStats.correctAnswers++;
        progress.dailyStats.correctAnswers++;
        progress.weeklyStats.correctAnswers++;
        progress.allTimeStats.totalCorrectAnswers++;
        progress.currentStreak++;
        progress.sessionStats.currentStreak++;
        progress.bestStreak = Math.max(progress.bestStreak, progress.currentStreak);
        progress.dailyStats.bestStreak = Math.max(progress.dailyStats.bestStreak, progress.currentStreak);
        progress.weeklyStats.bestStreak = Math.max(progress.weeklyStats.bestStreak, progress.currentStreak);
        progress.allTimeStats.bestStreak = Math.max(progress.allTimeStats.bestStreak, progress.currentStreak);
        break;

      case 'wrong_answer':
        progress.currentStreak = 0;
        progress.sessionStats.currentStreak = 0;
        break;

      case 'session_start':
        progress.sessionStats.sessionStartTime = now;
        progress.dailyStats.sessionsPlayed++;
        progress.weeklyStats.sessionsPlayed++;
        progress.allTimeStats.totalSessions++;
        break;

      case 'session_end':
        const sessionDuration = now.getTime() - progress.sessionStats.sessionStartTime.getTime();
        progress.sessionStats.sessionDuration = sessionDuration;
        progress.dailyStats.totalPlayTime += sessionDuration;
        progress.weeklyStats.totalPlayTime += sessionDuration;
        progress.allTimeStats.totalPlayTime += sessionDuration;
        break;
    }

    // Update daily/weekly stats if necessary
    if (progress.dailyStats.date !== today) {
      progress.dailyStats = {
        date: today,
        questionsAnswered: 0,
        correctAnswers: 0,
        bestStreak: 0,
        totalPlayTime: 0,
        topicsEngaged: new Set(),
        sessionsPlayed: 0
      };
    }

    if (progress.weeklyStats.week !== thisWeek) {
      progress.weeklyStats = {
        week: thisWeek,
        questionsAnswered: 0,
        correctAnswers: 0,
        bestStreak: 0,
        totalPlayTime: 0,
        topicsEngaged: new Set(),
        sessionsPlayed: 0,
        consistencyDays: 0
      };
    }

    // Check for achievement progress
    await this._checkPlayerAchievements(player);
    
    // Save progress periodically (every few actions to avoid excessive saves)
    if (action === 'session_end' || (action === 'correct_answer' && progress.currentStreak % 5 === 0)) {
      await this._savePlayerAchievements(player, progress);
    }
  }

  /**
   * Check achievements for a specific player with persistence support
   */
  private async _checkPlayerAchievements(player: Player): Promise<void> {
    const progress = this._playerProgress.get(player.id);
    if (!progress) return;

    const unlockedAchievements: Achievement[] = [];

    this._achievements.forEach((achievement, id) => {
      const achievementProgress = progress.achievementProgress.get(id);
      if (!achievementProgress || achievementProgress.isUnlocked) return;

      const meetsRequirements = this._checkAchievementRequirements(achievement, progress);
      if (meetsRequirements) {
        unlockedAchievements.push(achievement);
      }
    });

    // Unlock achievements and save once at the end
    for (const achievement of unlockedAchievements) {
      await this._unlockAchievement(player, achievement);
    }
  }

  /**
   * Check achievements for a specific player (sync version for compatibility)
   */
  private _checkPlayerAchievementsSync(playerId: string): void {
    // This method maintains compatibility but doesn't persist
    // Used only for periodic checks where we don't have Player object
    const progress = this._playerProgress.get(playerId);
    if (!progress) return;

    this._achievements.forEach((achievement, id) => {
      const achievementProgress = progress.achievementProgress.get(id);
      if (!achievementProgress || achievementProgress.isUnlocked) return;

      const meetsRequirements = this._checkAchievementRequirements(achievement, progress);
      if (meetsRequirements) {
        // Mark as unlocked but don't persist (will be saved on next recordAction)
        achievementProgress.isUnlocked = true;
        achievementProgress.unlockedDate = new Date();
        achievementProgress.currentTier = Math.min((achievementProgress.currentTier || 0) + 1, achievement.maxTiers || 1);
        
        progress.unlockedAchievements.add(achievement.id);
        progress.totalPoints += achievement.points;

        console.log(`[AchievementSystem] Player ${playerId} unlocked achievement: ${achievement.name} (deferred save)`);
      }
    });
  }

  /**
   * Check if player meets achievement requirements
   */
  private _checkAchievementRequirements(achievement: Achievement, progress: PlayerAchievementProgress): boolean {
    return achievement.requirements.every(req => {
      switch (req.type) {
        case 'streak':
          return this._compareValue(progress.currentStreak, req.value, req.comparison);
        
        case 'accuracy':
          const accuracy = this._getAccuracy(progress, req.timeframe);
          return this._compareValue(accuracy, req.value, req.comparison);
        
        case 'speed':
          return this._compareValue(progress.sessionStats.averageResponseTime, req.value, req.comparison);
        
        case 'count':
          const count = this._getCount(progress, req.timeframe);
          return this._compareValue(count, req.value, req.comparison);
        
        case 'time':
          if (req.timeframe === 'session') {
            if (achievement.id === AchievementType.EARLY_BIRD || achievement.id === AchievementType.NIGHT_OWL) {
              const hour = new Date().getHours();
              return this._compareValue(hour, req.value, req.comparison);
            }
            return this._compareValue(progress.sessionStats.sessionDuration, req.value, req.comparison);
          }
          return false;
        
        case 'topic':
          return progress.sessionStats.topicsEngaged.size >= req.value;
        
        default:
          return false;
      }
    });
  }

  /**
   * Get accuracy for timeframe
   */
  private _getAccuracy(progress: PlayerAchievementProgress, timeframe?: string): number {
    switch (timeframe) {
      case 'session':
        return progress.sessionStats.questionsAnswered > 0 ? 
          progress.sessionStats.correctAnswers / progress.sessionStats.questionsAnswered : 0;
      case 'day':
        return progress.dailyStats.questionsAnswered > 0 ? 
          progress.dailyStats.correctAnswers / progress.dailyStats.questionsAnswered : 0;
      case 'week':
        return progress.weeklyStats.questionsAnswered > 0 ? 
          progress.weeklyStats.correctAnswers / progress.weeklyStats.questionsAnswered : 0;
      case 'allTime':
      default:
        return progress.allTimeStats.totalQuestionsAnswered > 0 ? 
          progress.allTimeStats.totalCorrectAnswers / progress.allTimeStats.totalQuestionsAnswered : 0;
    }
  }

  /**
   * Get count for timeframe
   */
  private _getCount(progress: PlayerAchievementProgress, timeframe?: string): number {
    switch (timeframe) {
      case 'session':
        return progress.sessionStats.questionsAnswered;
      case 'day':
        return progress.dailyStats.questionsAnswered;
      case 'week':
        return progress.weeklyStats.questionsAnswered;
      case 'allTime':
      default:
        return progress.allTimeStats.totalQuestionsAnswered;
    }
  }

  /**
   * Compare values
   */
  private _compareValue(actual: number, target: number, comparison: string): boolean {
    switch (comparison) {
      case 'equals':
        return actual === target;
      case 'greater':
        return actual > target;
      case 'less':
        return actual < target;
      case 'greaterOrEqual':
        return actual >= target;
      case 'lessOrEqual':
        return actual <= target;
      default:
        return false;
    }
  }

  /**
   * Unlock achievement with immediate persistence
   */
  private async _unlockAchievement(player: Player, achievement: Achievement): Promise<void> {
    const progress = this._playerProgress.get(player.id);
    if (!progress) return;

    const achievementProgress = progress.achievementProgress.get(achievement.id);
    if (!achievementProgress) return;

    achievementProgress.isUnlocked = true;
    achievementProgress.unlockedDate = new Date();
    achievementProgress.currentTier = Math.min((achievementProgress.currentTier || 0) + 1, achievement.maxTiers || 1);
    
    progress.unlockedAchievements.add(achievement.id);
    progress.totalPoints += achievement.points;

    // Create notification
    const notification: AchievementNotification = {
      achievement,
      playerId: player.id,
      unlockedDate: new Date(),
      isNewTier: achievementProgress.currentTier > 1,
      previousTier: achievementProgress.currentTier - 1,
      currentTier: achievementProgress.currentTier
    };

    if (!this._pendingNotifications.has(player.id)) {
      this._pendingNotifications.set(player.id, []);
    }
    this._pendingNotifications.get(player.id)!.push(notification);

    // Save achievement progress immediately
    await this._savePlayerAchievements(player, progress);

    console.log(`[AchievementSystem] Player ${player.id} unlocked achievement: ${achievement.name} (Tier ${achievementProgress.currentTier})`);
  }

  /**
   * Check all player achievements
   */
  private _checkAllPlayerAchievements(): void {
    this._playerProgress.forEach((progress, playerId) => {
      this._checkPlayerAchievementsSync(playerId);
    });
  }

  /**
   * Get week string
   */
  private _getWeekString(date: Date): string {
    const year = date.getFullYear();
    const week = Math.ceil((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${week}`;
  }

  /**
   * Get player achievements
   */
  public getPlayerAchievements(playerId: string): PlayerAchievementProgress | null {
    return this._playerProgress.get(playerId) || null;
  }

  /**
   * Get pending notifications
   */
  public getPendingNotifications(playerId: string): AchievementNotification[] {
    const notifications = this._pendingNotifications.get(playerId) || [];
    this._pendingNotifications.delete(playerId);
    return notifications;
  }

  /**
   * Display achievement notification
   */
  public displayAchievementNotification(playerEntity: PlayerEntity, notification: AchievementNotification): void {
    if (!playerEntity.player || !this._world) return;

    const message = `🏆 Achievement Unlocked!\n${notification.achievement.icon} ${notification.achievement.name}\n${notification.achievement.description}\n+${notification.achievement.points} points`;
    
    console.log(`[AchievementSystem] ${message}`);
    
    // Create visual notification effect
    this._createNotificationEffect(playerEntity, notification);
  }

  /**
   * Create notification effect
   */
  private _createNotificationEffect(playerEntity: PlayerEntity, notification: AchievementNotification): void {
    if (!this._world) return;

    try {
      const position = playerEntity.getPosition();
      const effectPosition = {
        x: position.x,
        y: position.y + 3,
        z: position.z
      };

      // Create floating achievement icon
      const achievementEntity = new Entity({
        blockTextureUri: 'blocks/gold-ore.png',
        blockHalfExtents: { x: 0.3, y: 0.3, z: 0.3 },
        rigidBodyOptions: {
          type: RigidBodyType.DYNAMIC,
          gravityScale: -0.5,
          colliders: [{
            shape: ColliderShape.CUBOID,
            halfExtents: { x: 0.3, y: 0.3, z: 0.3 },
            isSensor: true
          }]
        }
      });

      achievementEntity.spawn(this._world, effectPosition);
      achievementEntity.setLinearVelocity({ x: 0, y: 2, z: 0 });
      achievementEntity.setAngularVelocity({ x: 0, y: 3, z: 0 });

      // Remove after animation
      setTimeout(() => {
        if (achievementEntity.isSpawned) {
          achievementEntity.despawn();
        }
      }, 3000);

    } catch (error) {
      console.error('[AchievementSystem] Error creating notification effect:', error);
    }
  }

  /**
   * Get achievement leaderboard
   */
  public getLeaderboard(): Array<{playerId: string, totalPoints: number, achievementCount: number}> {
    const leaderboard: Array<{playerId: string, totalPoints: number, achievementCount: number}> = [];
    
    this._playerProgress.forEach((progress, playerId) => {
      leaderboard.push({
        playerId,
        totalPoints: progress.totalPoints,
        achievementCount: progress.unlockedAchievements.size
      });
    });

    return leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
  }

  /**
   * Get achievement by ID
   */
  public getAchievement(id: AchievementType): Achievement | null {
    return this._achievements.get(id) || null;
  }

  /**
   * Get all achievements
   */
  public getAllAchievements(): Achievement[] {
    return Array.from(this._achievements.values());
  }

  /**
   * Reset player achievements
   */
  public resetPlayerAchievements(playerId: string): void {
    this._playerProgress.delete(playerId);
    this._pendingNotifications.delete(playerId);
    console.log(`[AchievementSystem] Reset achievements for player ${playerId}`);
  }

  /**
   * Cleanup achievement system
   */
  public cleanup(): void {
    if (this._achievementCheckInterval) {
      clearInterval(this._achievementCheckInterval);
      this._achievementCheckInterval = null;
    }

    this._playerProgress.clear();
    this._pendingNotifications.clear();
    console.log('[AchievementSystem] Cleaned up achievement system');
  }
}