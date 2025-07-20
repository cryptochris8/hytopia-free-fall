import { PlayerEntity, World, ui, Player } from 'hytopia';
import { CurriculumSystem, MathTopic, PlayerProgress, TopicProgress } from './CurriculumSystem';

/**
 * Performance Metrics Interface
 */
export interface PerformanceMetrics {
  playerId: string;
  sessionStartTime: Date;
  sessionEndTime?: Date;
  questionsAttempted: number;
  correctAnswers: number;
  accuracy: number;
  averageResponseTime: number;
  topicPerformance: Map<MathTopic, TopicMetrics>;
  improvements: string[];
  recommendations: string[];
}

/**
 * Topic Metrics Interface
 */
export interface TopicMetrics {
  topic: MathTopic;
  attempted: number;
  correct: number;
  accuracy: number;
  averageTime: number;
  improvement: number; // Percentage improvement from previous session
  difficulty: string;
}

/**
 * Session Analytics Interface
 */
export interface SessionAnalytics {
  playerId: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  questionsAnswered: number;
  correctAnswers: number;
  timeSpent: number;
  topicsEngaged: MathTopic[];
  performanceScore: number;
  difficultyProgression: boolean;
}

/**
 * Learning Pattern Interface
 */
export interface LearningPattern {
  playerId: string;
  strongTopics: MathTopic[];
  weakTopics: MathTopic[];
  optimalPlayTime: number;
  preferredDifficulty: string;
  learningVelocity: number;
  consistencyScore: number;
}

/**
 * Adaptive Recommendation Interface
 */
export interface AdaptiveRecommendation {
  type: 'practice' | 'review' | 'challenge' | 'break';
  topic: MathTopic;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: number;
  reason: string;
}

/**
 * Learning Analytics Dashboard - Tracks performance and provides insights
 */
export class LearningAnalyticsDashboard {
  private static _instance: LearningAnalyticsDashboard;
  private _world: World | null = null;
  private _curriculumSystem: CurriculumSystem;
  private _sessionAnalytics: Map<string, SessionAnalytics[]> = new Map();
  private _performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private _learningPatterns: Map<string, LearningPattern> = new Map();
  private _currentSessions: Map<string, SessionAnalytics> = new Map();
  private _analyticsUpdateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this._curriculumSystem = CurriculumSystem.getInstance();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): LearningAnalyticsDashboard {
    if (!LearningAnalyticsDashboard._instance) {
      LearningAnalyticsDashboard._instance = new LearningAnalyticsDashboard();
    }
    return LearningAnalyticsDashboard._instance;
  }

  /**
   * Save player analytics data to Hytopia persistence
   */
  private async _savePlayerAnalytics(player: Player): Promise<void> {
    try {
      const persistedData = await player.getPersistedData();
      const playerMetrics = this._playerMetrics.get(player.id);
      const currentSession = this._currentSessions.get(player.id);
      
      if (!playerMetrics) return;

      const analyticsData = {
        currentMetrics: {
          playerId: playerMetrics.playerId,
          sessionStartTime: playerMetrics.sessionStartTime.toISOString(),
          sessionEndTime: playerMetrics.sessionEndTime?.toISOString(),
          questionsAttempted: playerMetrics.questionsAttempted,
          correctAnswers: playerMetrics.correctAnswers,
          accuracy: playerMetrics.accuracy,
          averageResponseTime: playerMetrics.averageResponseTime,
          improvements: playerMetrics.improvements,
          recommendations: playerMetrics.recommendations,
          topicPerformance: Array.from(playerMetrics.topicPerformance.entries()).map(([topic, metrics]) => ({
            topic,
            attempted: metrics.attempted,
            correct: metrics.correct,
            accuracy: metrics.accuracy,
            averageTime: metrics.averageTime,
            improvement: metrics.improvement,
            difficulty: metrics.difficulty
          }))
        },
        currentSession: currentSession ? {
          playerId: currentSession.playerId,
          sessionId: currentSession.sessionId,
          startTime: currentSession.startTime.toISOString(),
          endTime: currentSession.endTime?.toISOString(),
          questionsAnswered: currentSession.questionsAnswered,
          correctAnswers: currentSession.correctAnswers,
          timeSpent: currentSession.timeSpent,
          topicsEngaged: currentSession.topicsEngaged,
          performanceScore: currentSession.performanceScore,
          difficultyProgression: currentSession.difficultyProgression
        } : null,
        sessionHistory: this._sessionHistory.get(player.id)?.map(session => ({
          playerId: session.playerId,
          sessionId: session.sessionId,
          startTime: session.startTime.toISOString(),
          endTime: session.endTime?.toISOString(),
          questionsAnswered: session.questionsAnswered,
          correctAnswers: session.correctAnswers,
          timeSpent: session.timeSpent,
          topicsEngaged: session.topicsEngaged,
          performanceScore: session.performanceScore,
          difficultyProgression: session.difficultyProgression
        })) || []
      };

      const updatedData = {
        ...persistedData,
        analytics: analyticsData
      };

      await player.setPersistedData(updatedData);
      console.log(`[LearningAnalyticsDashboard] Saved analytics data for player ${player.id}`);
    } catch (error) {
      console.error(`[LearningAnalyticsDashboard] Failed to save analytics data for player ${player.id}:`, error);
    }
  }

  /**
   * Load player analytics data from Hytopia persistence
   */
  private async _loadPlayerAnalytics(player: Player): Promise<void> {
    try {
      const persistedData = await player.getPersistedData();
      const analyticsData = persistedData?.analytics;
      
      if (!analyticsData) return;

      // Restore current metrics
      if (analyticsData.currentMetrics) {
        const topicPerformance = new Map<MathTopic, TopicMetrics>();
        if (analyticsData.currentMetrics.topicPerformance) {
          analyticsData.currentMetrics.topicPerformance.forEach((topicData: any) => {
            topicPerformance.set(topicData.topic, {
              topic: topicData.topic,
              attempted: topicData.attempted || 0,
              correct: topicData.correct || 0,
              accuracy: topicData.accuracy || 0,
              averageTime: topicData.averageTime || 0,
              improvement: topicData.improvement || 0,
              difficulty: topicData.difficulty || 'beginner'
            });
          });
        }

        const metrics: PerformanceMetrics = {
          playerId: player.id,
          sessionStartTime: new Date(analyticsData.currentMetrics.sessionStartTime),
          sessionEndTime: analyticsData.currentMetrics.sessionEndTime ? 
            new Date(analyticsData.currentMetrics.sessionEndTime) : undefined,
          questionsAttempted: analyticsData.currentMetrics.questionsAttempted || 0,
          correctAnswers: analyticsData.currentMetrics.correctAnswers || 0,
          accuracy: analyticsData.currentMetrics.accuracy || 0,
          averageResponseTime: analyticsData.currentMetrics.averageResponseTime || 0,
          topicPerformance,
          improvements: analyticsData.currentMetrics.improvements || [],
          recommendations: analyticsData.currentMetrics.recommendations || []
        };

        this._playerMetrics.set(player.id, metrics);
      }

      // Restore current session
      if (analyticsData.currentSession) {
        const session: SessionAnalytics = {
          playerId: player.id,
          sessionId: analyticsData.currentSession.sessionId,
          startTime: new Date(analyticsData.currentSession.startTime),
          endTime: analyticsData.currentSession.endTime ? 
            new Date(analyticsData.currentSession.endTime) : undefined,
          questionsAnswered: analyticsData.currentSession.questionsAnswered || 0,
          correctAnswers: analyticsData.currentSession.correctAnswers || 0,
          timeSpent: analyticsData.currentSession.timeSpent || 0,
          topicsEngaged: analyticsData.currentSession.topicsEngaged || [],
          performanceScore: analyticsData.currentSession.performanceScore || 0,
          difficultyProgression: analyticsData.currentSession.difficultyProgression || false
        };

        this._currentSessions.set(player.id, session);
      }

      // Restore session history
      if (analyticsData.sessionHistory) {
        const history = analyticsData.sessionHistory.map((sessionData: any) => ({
          playerId: player.id,
          sessionId: sessionData.sessionId,
          startTime: new Date(sessionData.startTime),
          endTime: sessionData.endTime ? new Date(sessionData.endTime) : undefined,
          questionsAnswered: sessionData.questionsAnswered || 0,
          correctAnswers: sessionData.correctAnswers || 0,
          timeSpent: sessionData.timeSpent || 0,
          topicsEngaged: sessionData.topicsEngaged || [],
          performanceScore: sessionData.performanceScore || 0,
          difficultyProgression: sessionData.difficultyProgression || false
        }));

        this._sessionHistory.set(player.id, history);
      }

      console.log(`[LearningAnalyticsDashboard] Loaded analytics data for player ${player.id}`);
    } catch (error) {
      console.error(`[LearningAnalyticsDashboard] Failed to load analytics data for player ${player.id}:`, error);
    }
  }

  /**
   * Initialize the analytics dashboard
   */
  public initialize(world: World): void {
    this._world = world;
    this._startAnalyticsUpdates();
    console.log('[LearningAnalyticsDashboard] Initialized analytics dashboard');
  }

  /**
   * Start analytics updates
   */
  private _startAnalyticsUpdates(): void {
    if (this._analyticsUpdateInterval) {
      clearInterval(this._analyticsUpdateInterval);
    }

    this._analyticsUpdateInterval = setInterval(() => {
      this._updateAllAnalytics();
    }, 30000); // Update every 30 seconds
  }

  /**
   * Initialize player analytics with persistence support
   */
  public async initializePlayerAnalytics(player: Player): Promise<void> {
    // Load existing analytics data
    await this._loadPlayerAnalytics(player);
    
    // If no data exists, the maps will remain empty (which is fine)
    console.log(`[LearningAnalyticsDashboard] Initialized analytics for player ${player.id}`);
  }

  /**
   * Start a learning session with persistence support
   */
  public async startSession(player: Player): Promise<string> {
    const sessionId = `session_${player.id}_${Date.now()}`;
    const session: SessionAnalytics = {
      playerId: player.id,
      sessionId,
      startTime: new Date(),
      questionsAnswered: 0,
      correctAnswers: 0,
      timeSpent: 0,
      topicsEngaged: [],
      performanceScore: 0,
      difficultyProgression: false
    };

    this._currentSessions.set(player.id, session);
    
    // Initialize session analytics array if not exists
    if (!this._sessionAnalytics.has(player.id)) {
      this._sessionAnalytics.set(player.id, []);
    }

    // Save session start
    await this._savePlayerAnalytics(player);

    console.log(`[LearningAnalyticsDashboard] Started session ${sessionId} for player ${player.id}`);
    return sessionId;
  }

  /**
   * End a learning session with persistence support
   */
  public async endSession(player: Player): Promise<SessionAnalytics | null> {
    const currentSession = this._currentSessions.get(player.id);
    if (!currentSession) return null;

    currentSession.endTime = new Date();
    currentSession.timeSpent = currentSession.endTime.getTime() - currentSession.startTime.getTime();
    currentSession.performanceScore = this._calculatePerformanceScore(currentSession);

    // Store session in history
    this._sessionAnalytics.get(player.id)!.push(currentSession);
    
    // Also store in session history map
    if (!this._sessionHistory.has(player.id)) {
      this._sessionHistory.set(player.id, []);
    }
    this._sessionHistory.get(player.id)!.push(currentSession);
    
    this._currentSessions.delete(player.id);

    // Update learning patterns
    this._updateLearningPattern(player.id);

    // Save final session data
    await this._savePlayerAnalytics(player);

    console.log(`[LearningAnalyticsDashboard] Ended session ${currentSession.sessionId} for player ${player.id}`);
    return currentSession;
  }

  /**
   * Record question attempt
   */
  public recordQuestionAttempt(
    playerId: string,
    topic: MathTopic,
    isCorrect: boolean,
    responseTime: number
  ): void {
    const currentSession = this._currentSessions.get(playerId);
    if (!currentSession) return;

    currentSession.questionsAnswered++;
    if (isCorrect) {
      currentSession.correctAnswers++;
    }

    if (!currentSession.topicsEngaged.includes(topic)) {
      currentSession.topicsEngaged.push(topic);
    }

    // Update performance metrics
    this._updatePerformanceMetrics(playerId, topic, isCorrect, responseTime);

    console.log(`[LearningAnalyticsDashboard] Recorded question attempt for player ${playerId}: ${topic} (${isCorrect ? 'correct' : 'wrong'})`);
  }

  /**
   * Update performance metrics
   */
  private _updatePerformanceMetrics(
    playerId: string,
    topic: MathTopic,
    isCorrect: boolean,
    responseTime: number
  ): void {
    let metrics = this._performanceMetrics.get(playerId);
    if (!metrics) {
      metrics = {
        playerId,
        sessionStartTime: new Date(),
        questionsAttempted: 0,
        correctAnswers: 0,
        accuracy: 0,
        averageResponseTime: 0,
        topicPerformance: new Map(),
        improvements: [],
        recommendations: []
      };
      this._performanceMetrics.set(playerId, metrics);
    }

    // Update overall metrics
    metrics.questionsAttempted++;
    if (isCorrect) {
      metrics.correctAnswers++;
    }
    metrics.accuracy = metrics.correctAnswers / metrics.questionsAttempted;
    metrics.averageResponseTime = (metrics.averageResponseTime * (metrics.questionsAttempted - 1) + responseTime) / metrics.questionsAttempted;

    // Update topic-specific metrics
    let topicMetrics = metrics.topicPerformance.get(topic);
    if (!topicMetrics) {
      topicMetrics = {
        topic,
        attempted: 0,
        correct: 0,
        accuracy: 0,
        averageTime: 0,
        improvement: 0,
        difficulty: 'beginner'
      };
      metrics.topicPerformance.set(topic, topicMetrics);
    }

    const previousAccuracy = topicMetrics.accuracy;
    topicMetrics.attempted++;
    if (isCorrect) {
      topicMetrics.correct++;
    }
    topicMetrics.accuracy = topicMetrics.correct / topicMetrics.attempted;
    topicMetrics.averageTime = (topicMetrics.averageTime * (topicMetrics.attempted - 1) + responseTime) / topicMetrics.attempted;
    topicMetrics.improvement = topicMetrics.accuracy - previousAccuracy;

    // Generate recommendations
    this._generateRecommendations(playerId);
  }

  /**
   * Generate adaptive recommendations
   */
  private _generateRecommendations(playerId: string): void {
    const metrics = this._performanceMetrics.get(playerId);
    const progress = this._curriculumSystem.getPlayerProgress(playerId);
    if (!metrics || !progress) return;

    const recommendations: AdaptiveRecommendation[] = [];

    // Analyze performance patterns
    metrics.topicPerformance.forEach((topicMetrics, topic) => {
      if (topicMetrics.accuracy < 0.6) {
        recommendations.push({
          type: 'practice',
          topic,
          description: `Practice ${topic} to improve accuracy`,
          priority: 'high',
          estimatedTime: 10,
          reason: `Low accuracy (${Math.round(topicMetrics.accuracy * 100)}%)`
        });
      } else if (topicMetrics.accuracy > 0.9 && topicMetrics.averageTime < 5000) {
        recommendations.push({
          type: 'challenge',
          topic,
          description: `Try advanced ${topic} problems`,
          priority: 'medium',
          estimatedTime: 15,
          reason: `High accuracy and fast response time`
        });
      }

      if (topicMetrics.averageTime > 15000) {
        recommendations.push({
          type: 'review',
          topic,
          description: `Review ${topic} fundamentals`,
          priority: 'medium',
          estimatedTime: 8,
          reason: `Slow response time (${Math.round(topicMetrics.averageTime / 1000)}s)`
        });
      }
    });

    // Check for fatigue
    const currentSession = this._currentSessions.get(playerId);
    if (currentSession && currentSession.questionsAnswered > 20) {
      recommendations.push({
        type: 'break',
        topic: MathTopic.BASIC_ARITHMETIC,
        description: 'Take a short break to maintain focus',
        priority: 'high',
        estimatedTime: 5,
        reason: 'Extended play session detected'
      });
    }

    // Store recommendations in metrics
    metrics.recommendations = recommendations.map(r => `${r.type}: ${r.description}`);
  }

  /**
   * Calculate performance score
   */
  private _calculatePerformanceScore(session: SessionAnalytics): number {
    if (session.questionsAnswered === 0) return 0;

    const accuracy = session.correctAnswers / session.questionsAnswered;
    const timeBonus = Math.max(0, 1 - (session.timeSpent / 1000 / 60 / 30)); // Bonus for completing in under 30 minutes
    const topicDiversity = session.topicsEngaged.length * 0.1;

    return Math.round((accuracy * 70 + timeBonus * 20 + topicDiversity * 10) * 100);
  }

  /**
   * Update learning pattern
   */
  private _updateLearningPattern(playerId: string): void {
    const progress = this._curriculumSystem.getPlayerProgress(playerId);
    const sessions = this._sessionAnalytics.get(playerId);
    if (!progress || !sessions || sessions.length === 0) return;

    const pattern: LearningPattern = {
      playerId,
      strongTopics: [],
      weakTopics: [],
      optimalPlayTime: 0,
      preferredDifficulty: 'beginner',
      learningVelocity: 0,
      consistencyScore: 0
    };

    // Analyze topic performance
    progress.topicProgress.forEach((topicProgress, topic) => {
      if (topicProgress.accuracy > 0.8) {
        pattern.strongTopics.push(topic);
      } else if (topicProgress.accuracy < 0.6) {
        pattern.weakTopics.push(topic);
      }
    });

    // Calculate optimal play time
    const sessionDurations = sessions.map(s => s.timeSpent);
    const avgSessionTime = sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length;
    pattern.optimalPlayTime = avgSessionTime;

    // Calculate learning velocity (improvement over time)
    if (sessions.length > 1) {
      const recentSessions = sessions.slice(-5);
      const firstAccuracy = recentSessions[0].correctAnswers / recentSessions[0].questionsAnswered;
      const lastAccuracy = recentSessions[recentSessions.length - 1].correctAnswers / recentSessions[recentSessions.length - 1].questionsAnswered;
      pattern.learningVelocity = (lastAccuracy - firstAccuracy) / recentSessions.length;
    }

    // Calculate consistency score
    const accuracies = sessions.map(s => s.correctAnswers / s.questionsAnswered);
    const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracies.length;
    pattern.consistencyScore = Math.max(0, 1 - variance);

    this._learningPatterns.set(playerId, pattern);
    console.log(`[LearningAnalyticsDashboard] Updated learning pattern for player ${playerId}`);
  }

  /**
   * Update all analytics
   */
  private _updateAllAnalytics(): void {
    this._currentSessions.forEach((session, playerId) => {
      const currentTime = new Date();
      session.timeSpent = currentTime.getTime() - session.startTime.getTime();
      
      // Check for session timeout (30 minutes)
      if (session.timeSpent > 30 * 60 * 1000) {
        this.endSession(playerId);
      }
    });
  }

  /**
   * Get performance metrics for a player
   */
  public getPerformanceMetrics(playerId: string): PerformanceMetrics | null {
    return this._performanceMetrics.get(playerId) || null;
  }

  /**
   * Get learning pattern for a player
   */
  public getLearningPattern(playerId: string): LearningPattern | null {
    return this._learningPatterns.get(playerId) || null;
  }

  /**
   * Get session history for a player
   */
  public getSessionHistory(playerId: string): SessionAnalytics[] {
    return this._sessionAnalytics.get(playerId) || [];
  }

  /**
   * Get adaptive recommendations for a player
   */
  public getRecommendations(playerId: string): AdaptiveRecommendation[] {
    const metrics = this._performanceMetrics.get(playerId);
    if (!metrics) return [];

    const recommendations: AdaptiveRecommendation[] = [];
    const pattern = this._learningPatterns.get(playerId);
    const progress = this._curriculumSystem.getPlayerProgress(playerId);

    if (!pattern || !progress) return recommendations;

    // Generate recommendations based on learning pattern
    if (pattern.weakTopics.length > 0) {
      pattern.weakTopics.forEach(topic => {
        recommendations.push({
          type: 'practice',
          topic,
          description: `Focus on ${topic} fundamentals`,
          priority: 'high',
          estimatedTime: 12,
          reason: 'Identified as weak area'
        });
      });
    }

    if (pattern.strongTopics.length > 0 && pattern.learningVelocity > 0.1) {
      recommendations.push({
        type: 'challenge',
        topic: pattern.strongTopics[0],
        description: `Try advanced problems in your strong topic`,
        priority: 'medium',
        estimatedTime: 15,
        reason: 'High performance and positive learning velocity'
      });
    }

    return recommendations;
  }

  /**
   * Display analytics dashboard to player
   */
  public displayDashboard(playerEntity: PlayerEntity): void {
    if (!playerEntity.player) return;

    const playerId = playerEntity.player.id;
    const metrics = this.getPerformanceMetrics(playerId);
    const pattern = this.getLearningPattern(playerId);
    const recommendations = this.getRecommendations(playerId);

    if (!metrics) return;

    let dashboardText = `📊 Learning Analytics Dashboard\n\n`;
    dashboardText += `📈 Overall Performance:\n`;
    dashboardText += `• Accuracy: ${Math.round(metrics.accuracy * 100)}%\n`;
    dashboardText += `• Questions Attempted: ${metrics.questionsAttempted}\n`;
    dashboardText += `• Avg Response Time: ${Math.round(metrics.averageResponseTime / 1000)}s\n\n`;

    dashboardText += `🎯 Topic Performance:\n`;
    metrics.topicPerformance.forEach((topicMetrics, topic) => {
      dashboardText += `• ${topic}: ${Math.round(topicMetrics.accuracy * 100)}% (${topicMetrics.attempted} attempts)\n`;
    });

    if (pattern) {
      dashboardText += `\n💪 Strong Topics: ${pattern.strongTopics.join(', ')}\n`;
      dashboardText += `🎯 Focus Areas: ${pattern.weakTopics.join(', ')}\n`;
      dashboardText += `📊 Consistency: ${Math.round(pattern.consistencyScore * 100)}%\n`;
    }

    if (recommendations.length > 0) {
      dashboardText += `\n💡 Recommendations:\n`;
      recommendations.slice(0, 3).forEach(rec => {
        dashboardText += `• ${rec.description}\n`;
      });
    }

    console.log(`[LearningAnalyticsDashboard] Displaying dashboard for player ${playerId}`);
    console.log(dashboardText);
  }

  /**
   * Export analytics data
   */
  public exportAnalytics(playerId: string): object {
    return {
      performance: this.getPerformanceMetrics(playerId),
      pattern: this.getLearningPattern(playerId),
      sessions: this.getSessionHistory(playerId),
      recommendations: this.getRecommendations(playerId)
    };
  }

  /**
   * Get system-wide analytics
   */
  public getSystemAnalytics(): object {
    const totalPlayers = this._performanceMetrics.size;
    const totalSessions = Array.from(this._sessionAnalytics.values()).reduce((sum, sessions) => sum + sessions.length, 0);
    const totalQuestions = Array.from(this._performanceMetrics.values()).reduce((sum, metrics) => sum + metrics.questionsAttempted, 0);

    return {
      totalPlayers,
      totalSessions,
      totalQuestions,
      averageAccuracy: Array.from(this._performanceMetrics.values()).reduce((sum, metrics) => sum + metrics.accuracy, 0) / totalPlayers,
      activeSessions: this._currentSessions.size
    };
  }

  /**
   * Cleanup analytics dashboard
   */
  public cleanup(): void {
    if (this._analyticsUpdateInterval) {
      clearInterval(this._analyticsUpdateInterval);
      this._analyticsUpdateInterval = null;
    }

    this._sessionAnalytics.clear();
    this._performanceMetrics.clear();
    this._learningPatterns.clear();
    this._currentSessions.clear();
    
    console.log('[LearningAnalyticsDashboard] Cleaned up analytics dashboard');
  }
}