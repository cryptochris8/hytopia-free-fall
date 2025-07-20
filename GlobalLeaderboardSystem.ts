import {
  World,
  Player
} from 'hytopia';

interface PlayerStats {
  playerId: string;
  username: string;
  totalGamesPlayed: number;
  totalQuestionsAnswered: number;
  correctAnswers: number;
  bestStreak: number;
  averageAccuracy: number;
  totalScore: number;
  bestSingleGameScore: number;
  fastestCompletionTime: number;
  racesWon: number;
  racesParticipated: number;
  teamChallengesWon: number;
  teamChallengesParticipated: number;
  favoriteSubject: string;
  lastPlayed: number;
  achievements: string[];
  rank: number;
  rankPoints: number;
}

interface LeaderboardEntry {
  username: string;
  score: number;
  additionalData?: any;
}

interface SeasonData {
  seasonId: number;
  startDate: number;
  endDate: number;
  topPlayers: LeaderboardEntry[];
  rewards: { rank: number; reward: string }[];
}

export default class GlobalLeaderboardSystem {
  private static _instance: GlobalLeaderboardSystem;
  private _world: World | undefined;
  private _playerStats: Map<string, PlayerStats> = new Map();
  private _leaderboards: Map<string, LeaderboardEntry[]> = new Map();
  private _currentSeason: SeasonData | undefined;
  private _seasonNumber: number = 1;

  // Leaderboard types
  public static readonly LEADERBOARD_TYPES = {
    DAILY_SCORE: 'daily_score',
    WEEKLY_SCORE: 'weekly_score',
    ALL_TIME_SCORE: 'all_time_score',
    RACE_WINS: 'race_wins',
    TEAM_WINS: 'team_wins',
    ACCURACY: 'accuracy',
    SPEED_RUN: 'speed_run',
    STREAK: 'streak',
    GRADE_LEVEL: 'grade_level',
    SUBJECT: 'subject'
  };

  // Rank thresholds
  private static readonly RANK_THRESHOLDS = [
    { rank: 'Bronze', minPoints: 0, color: 'CD7F32' },
    { rank: 'Silver', minPoints: 1000, color: 'C0C0C0' },
    { rank: 'Gold', minPoints: 2500, color: 'FFD700' },
    { rank: 'Platinum', minPoints: 5000, color: 'E5E4E2' },
    { rank: 'Diamond', minPoints: 10000, color: '00D4FF' },
    { rank: 'Master', minPoints: 20000, color: 'FF00FF' },
    { rank: 'Grandmaster', minPoints: 50000, color: 'FF0000' }
  ];

  public static get instance(): GlobalLeaderboardSystem {
    if (!this._instance) {
      this._instance = new GlobalLeaderboardSystem();
    }
    return this._instance;
  }

  private constructor() {
    // Initialize leaderboards
    Object.values(GlobalLeaderboardSystem.LEADERBOARD_TYPES).forEach(type => {
      this._leaderboards.set(type, []);
    });

    // Start season
    this.startNewSeason();
  }

  public initialize(world: World): void {
    this._world = world;
    
    // Start periodic updates
    this.startPeriodicUpdates();
  }

  public async loadPlayerStats(player: Player): Promise<PlayerStats> {
    // Try to load from persisted data
    const persistedData = await player.getPersistedData();
    
    if (persistedData && persistedData.globalStats) {
      const stats = persistedData.globalStats as PlayerStats;
      this._playerStats.set(player.id, stats);
      return stats;
    }

    // Create new stats for player
    const newStats: PlayerStats = {
      playerId: player.id,
      username: player.username,
      totalGamesPlayed: 0,
      totalQuestionsAnswered: 0,
      correctAnswers: 0,
      bestStreak: 0,
      averageAccuracy: 0,
      totalScore: 0,
      bestSingleGameScore: 0,
      fastestCompletionTime: Infinity,
      racesWon: 0,
      racesParticipated: 0,
      teamChallengesWon: 0,
      teamChallengesParticipated: 0,
      favoriteSubject: 'arithmetic',
      lastPlayed: Date.now(),
      achievements: [],
      rank: 0,
      rankPoints: 0
    };

    this._playerStats.set(player.id, newStats);
    return newStats;
  }

  public updatePlayerGameStats(
    player: Player,
    gameData: {
      questionsAnswered: number;
      correctAnswers: number;
      score: number;
      completionTime?: number;
      streak?: number;
      subject?: string;
    }
  ): void {
    const stats = this._playerStats.get(player.id);
    if (!stats) return;

    // Update basic stats
    stats.totalGamesPlayed++;
    stats.totalQuestionsAnswered += gameData.questionsAnswered;
    stats.correctAnswers += gameData.correctAnswers;
    stats.totalScore += gameData.score;
    stats.lastPlayed = Date.now();

    // Update best scores
    if (gameData.score > stats.bestSingleGameScore) {
      stats.bestSingleGameScore = gameData.score;
    }

    if (gameData.streak && gameData.streak > stats.bestStreak) {
      stats.bestStreak = gameData.streak;
    }

    if (gameData.completionTime && gameData.completionTime < stats.fastestCompletionTime) {
      stats.fastestCompletionTime = gameData.completionTime;
    }

    // Update accuracy
    stats.averageAccuracy = (stats.correctAnswers / stats.totalQuestionsAnswered) * 100;

    // Update rank points
    const pointsEarned = this.calculateRankPoints(gameData);
    stats.rankPoints += pointsEarned;
    stats.rank = this.calculateRank(stats.rankPoints);

    // Save and update leaderboards
    this.savePlayerStats(player, stats);
    this.updateLeaderboards(stats);

    // Send update to player
    player.ui.sendData({
      type: 'stats-update',
      stats: {
        totalScore: stats.totalScore,
        rank: this.getRankInfo(stats.rank),
        rankPoints: stats.rankPoints,
        pointsEarned
      }
    });
  }

  public updateRaceStats(player: Player, won: boolean): void {
    const stats = this._playerStats.get(player.id);
    if (!stats) return;

    stats.racesParticipated++;
    if (won) {
      stats.racesWon++;
      stats.rankPoints += 200; // Bonus points for race win
    }

    this.savePlayerStats(player, stats);
    this.updateLeaderboards(stats);
  }

  public updateTeamStats(player: Player, won: boolean): void {
    const stats = this._playerStats.get(player.id);
    if (!stats) return;

    stats.teamChallengesParticipated++;
    if (won) {
      stats.teamChallengesWon++;
      stats.rankPoints += 300; // Bonus points for team win
    }

    this.savePlayerStats(player, stats);
    this.updateLeaderboards(stats);
  }

  public awardAchievement(player: Player, achievementId: string): void {
    const stats = this._playerStats.get(player.id);
    if (!stats || stats.achievements.includes(achievementId)) return;

    stats.achievements.push(achievementId);
    stats.rankPoints += 100; // Points for achievement

    this.savePlayerStats(player, stats);

    // Notify player
    player.ui.sendData({
      type: 'achievement-unlocked',
      achievementId,
      reward: 100
    });
  }

  public getLeaderboard(type: string, limit: number = 100): LeaderboardEntry[] {
    const leaderboard = this._leaderboards.get(type) || [];
    return leaderboard.slice(0, limit);
  }

  public getPlayerRank(player: Player, leaderboardType: string): number {
    const leaderboard = this._leaderboards.get(leaderboardType) || [];
    const index = leaderboard.findIndex(entry => entry.username === player.username);
    return index === -1 ? -1 : index + 1;
  }

  public getPlayerStats(player: Player): PlayerStats | undefined {
    return this._playerStats.get(player.id);
  }

  public async getTopPlayersAroundPlayer(player: Player, leaderboardType: string, range: number = 5): Promise<{
    entries: LeaderboardEntry[];
    playerRank: number;
  }> {
    const leaderboard = this._leaderboards.get(leaderboardType) || [];
    const playerRank = this.getPlayerRank(player, leaderboardType);
    
    if (playerRank === -1) {
      return {
        entries: leaderboard.slice(0, range * 2),
        playerRank: -1
      };
    }

    const startIndex = Math.max(0, playerRank - range - 1);
    const endIndex = Math.min(leaderboard.length, playerRank + range);
    
    return {
      entries: leaderboard.slice(startIndex, endIndex),
      playerRank
    };
  }

  private calculateRankPoints(gameData: any): number {
    let points = 0;

    // Base points for completion
    points += 50;

    // Points for correct answers
    points += gameData.correctAnswers * 10;

    // Accuracy bonus
    const accuracy = (gameData.correctAnswers / gameData.questionsAnswered) * 100;
    if (accuracy >= 90) points += 100;
    else if (accuracy >= 80) points += 50;
    else if (accuracy >= 70) points += 25;

    // Speed bonus
    if (gameData.completionTime) {
      if (gameData.completionTime < 60000) points += 100; // Under 1 minute
      else if (gameData.completionTime < 120000) points += 50; // Under 2 minutes
    }

    // Streak bonus
    if (gameData.streak) {
      points += gameData.streak * 5;
    }

    return points;
  }

  private calculateRank(rankPoints: number): number {
    for (let i = GlobalLeaderboardSystem.RANK_THRESHOLDS.length - 1; i >= 0; i--) {
      if (rankPoints >= GlobalLeaderboardSystem.RANK_THRESHOLDS[i].minPoints) {
        return i;
      }
    }
    return 0;
  }

  private getRankInfo(rankIndex: number): { name: string; color: string } {
    const rank = GlobalLeaderboardSystem.RANK_THRESHOLDS[rankIndex];
    return {
      name: rank.rank,
      color: rank.color
    };
  }

  private updateLeaderboards(stats: PlayerStats): void {
    // Update various leaderboards
    this.updateLeaderboard(GlobalLeaderboardSystem.LEADERBOARD_TYPES.ALL_TIME_SCORE, {
      username: stats.username,
      score: stats.totalScore
    });

    this.updateLeaderboard(GlobalLeaderboardSystem.LEADERBOARD_TYPES.RACE_WINS, {
      username: stats.username,
      score: stats.racesWon
    });

    this.updateLeaderboard(GlobalLeaderboardSystem.LEADERBOARD_TYPES.TEAM_WINS, {
      username: stats.username,
      score: stats.teamChallengesWon
    });

    this.updateLeaderboard(GlobalLeaderboardSystem.LEADERBOARD_TYPES.ACCURACY, {
      username: stats.username,
      score: Math.round(stats.averageAccuracy * 100) / 100
    });

    this.updateLeaderboard(GlobalLeaderboardSystem.LEADERBOARD_TYPES.STREAK, {
      username: stats.username,
      score: stats.bestStreak
    });

    if (stats.fastestCompletionTime < Infinity) {
      this.updateLeaderboard(GlobalLeaderboardSystem.LEADERBOARD_TYPES.SPEED_RUN, {
        username: stats.username,
        score: stats.fastestCompletionTime
      });
    }
  }

  private updateLeaderboard(type: string, entry: LeaderboardEntry): void {
    const leaderboard = this._leaderboards.get(type) || [];
    
    // Find existing entry
    const existingIndex = leaderboard.findIndex(e => e.username === entry.username);
    
    if (existingIndex !== -1) {
      // Update existing entry
      leaderboard[existingIndex] = entry;
    } else {
      // Add new entry
      leaderboard.push(entry);
    }

    // Sort leaderboard
    leaderboard.sort((a, b) => {
      // Speed run is sorted ascending (lower is better)
      if (type === GlobalLeaderboardSystem.LEADERBOARD_TYPES.SPEED_RUN) {
        return a.score - b.score;
      }
      // Everything else is sorted descending (higher is better)
      return b.score - a.score;
    });

    // Keep only top entries
    this._leaderboards.set(type, leaderboard.slice(0, 1000));
  }

  private savePlayerStats(player: Player, stats: PlayerStats): void {
    // Save to persisted data - check if methods exist to avoid errors
    if (player && typeof player.getPersistedData === 'function' && typeof player.setPersistedData === 'function') {
      try {
        player.getPersistedData().then(data => {
          const updatedData = {
            ...data,
            globalStats: stats
          };
          player.setPersistedData(updatedData);
        }).catch(error => {
          console.warn('[GlobalLeaderboardSystem] Failed to save player stats:', error);
        });
      } catch (error) {
        console.warn('[GlobalLeaderboardSystem] Error accessing player persistence methods:', error);
      }
    } else {
      console.warn('[GlobalLeaderboardSystem] Player object does not have persistence methods available');
    }
  }

  private startPeriodicUpdates(): void {
    // Update daily leaderboards
    setInterval(() => {
      this.resetDailyLeaderboards();
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Update weekly leaderboards
    setInterval(() => {
      this.resetWeeklyLeaderboards();
    }, 7 * 24 * 60 * 60 * 1000); // 7 days

    // Check season end
    setInterval(() => {
      this.checkSeasonEnd();
    }, 60 * 60 * 1000); // Every hour
  }

  private resetDailyLeaderboards(): void {
    this._leaderboards.set(GlobalLeaderboardSystem.LEADERBOARD_TYPES.DAILY_SCORE, []);
    
    // Notify all players
    if (this._world) {
      this._world.chatManager.sendBroadcastMessage(
        'Daily leaderboards have been reset! Start climbing!',
        '00FF00'
      );
    }
  }

  private resetWeeklyLeaderboards(): void {
    this._leaderboards.set(GlobalLeaderboardSystem.LEADERBOARD_TYPES.WEEKLY_SCORE, []);
    
    if (this._world) {
      this._world.chatManager.sendBroadcastMessage(
        'Weekly leaderboards have been reset! New week, new challenges!',
        '00FF00'
      );
    }
  }

  private startNewSeason(): void {
    this._currentSeason = {
      seasonId: this._seasonNumber++,
      startDate: Date.now(),
      endDate: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
      topPlayers: [],
      rewards: [
        { rank: 1, reward: 'Legendary Crown' },
        { rank: 2, reward: 'Epic Badge' },
        { rank: 3, reward: 'Rare Title' },
        { rank: 10, reward: 'Special Effects' },
        { rank: 100, reward: 'Season Participant Badge' }
      ]
    };
  }

  private checkSeasonEnd(): void {
    if (!this._currentSeason || Date.now() < this._currentSeason.endDate) return;

    // End current season
    this.endSeason();
    
    // Start new season
    this.startNewSeason();
  }

  private endSeason(): void {
    if (!this._currentSeason || !this._world) return;

    // Get top players
    const allTimeLeaderboard = this._leaderboards.get(GlobalLeaderboardSystem.LEADERBOARD_TYPES.ALL_TIME_SCORE) || [];
    this._currentSeason.topPlayers = allTimeLeaderboard.slice(0, 100);

    // Award season rewards
    this._currentSeason.topPlayers.forEach((entry, index) => {
      const rank = index + 1;
      const reward = this._currentSeason!.rewards.find(r => rank <= r.rank);
      
      if (reward) {
        // Find player and award reward
        const playerStats = Array.from(this._playerStats.values()).find(s => s.username === entry.username);
        if (playerStats) {
          playerStats.achievements.push(`Season ${this._currentSeason!.seasonId} - ${reward.reward}`);
        }
      }
    });

    // Announce season end
    this._world.chatManager.sendBroadcastMessage(
      `Season ${this._currentSeason.seasonId} has ended! Congratulations to all participants!`,
      'FFD700'
    );
  }

  public getSeasonInfo(): SeasonData | undefined {
    return this._currentSeason;
  }

  public getPlayerSeasonRank(player: Player): number {
    if (!this._currentSeason) return -1;
    
    const allTimeLeaderboard = this._leaderboards.get(GlobalLeaderboardSystem.LEADERBOARD_TYPES.ALL_TIME_SCORE) || [];
    const index = allTimeLeaderboard.findIndex(entry => entry.username === player.username);
    
    return index === -1 ? -1 : index + 1;
  }
}