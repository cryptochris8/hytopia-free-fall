import { PlayerEntity } from 'hytopia';
import { CurriculumSystem, MathTopic, DifficultyLevel, MathQuestion } from './CurriculumSystem';
import { LearningAnalyticsDashboard } from './LearningAnalyticsDashboard';

/**
 * Difficulty Adjustment Reasons
 */
export enum AdjustmentReason {
  HIGH_ACCURACY = "high_accuracy",
  LOW_ACCURACY = "low_accuracy",
  FAST_RESPONSE = "fast_response",
  SLOW_RESPONSE = "slow_response",
  CONSISTENT_PERFORMANCE = "consistent_performance",
  INCONSISTENT_PERFORMANCE = "inconsistent_performance",
  TOPIC_MASTERY = "topic_mastery",
  TOPIC_STRUGGLE = "topic_struggle",
  STREAK_BONUS = "streak_bonus",
  COMEBACK_ADJUSTMENT = "comeback_adjustment"
}

/**
 * Adaptive Parameters Interface
 */
export interface AdaptiveParameters {
  playerId: string;
  currentDifficulty: DifficultyLevel;
  targetAccuracy: number;
  responseTimeThreshold: number;
  streakBonus: number;
  adaptationRate: number;
  recentPerformance: PerformanceWindow;
  topicDifficulties: Map<MathTopic, TopicDifficulty>;
  lastAdjustment: Date;
  adjustmentHistory: DifficultyAdjustment[];
}

/**
 * Performance Window Interface
 */
export interface PerformanceWindow {
  windowSize: number;
  questions: QuestionAttempt[];
  accuracy: number;
  averageResponseTime: number;
  consistencyScore: number;
  topicDistribution: Map<MathTopic, number>;
}

/**
 * Question Attempt Interface
 */
export interface QuestionAttempt {
  questionId: string;
  topic: MathTopic;
  difficulty: DifficultyLevel;
  isCorrect: boolean;
  responseTime: number;
  timestamp: Date;
  playerConfidence?: number;
}

/**
 * Topic Difficulty Interface
 */
export interface TopicDifficulty {
  topic: MathTopic;
  currentLevel: DifficultyLevel;
  mastery: number;
  recentAccuracy: number;
  averageResponseTime: number;
  adjustmentCount: number;
  lastAdjustment: Date;
  isStable: boolean;
}

/**
 * Difficulty Adjustment Interface
 */
export interface DifficultyAdjustment {
  timestamp: Date;
  fromDifficulty: DifficultyLevel;
  toDifficulty: DifficultyLevel;
  topic: MathTopic;
  reason: AdjustmentReason;
  performanceData: {
    accuracy: number;
    responseTime: number;
    streak: number;
    confidence: number;
  };
  adjustmentMagnitude: number;
}

/**
 * Adaptive Recommendation Interface
 */
export interface AdaptiveRecommendation {
  type: 'increase' | 'decrease' | 'maintain' | 'focus' | 'diversify';
  topic: MathTopic;
  targetDifficulty: DifficultyLevel;
  confidence: number;
  reason: string;
  priority: number;
  estimatedImpact: number;
}

/**
 * Adaptive Difficulty System - Dynamically adjusts difficulty based on player performance
 */
export class AdaptiveDifficultySystem {
  private static _instance: AdaptiveDifficultySystem;
  private _curriculumSystem: CurriculumSystem;
  private _analyticsSystem: LearningAnalyticsDashboard;
  private _playerParameters: Map<string, AdaptiveParameters> = new Map();
  private _adaptationInterval: NodeJS.Timeout | null = null;
  private _performanceWindowSize: number = 10;
  private _minAdjustmentInterval: number = 30000; // 30 seconds minimum between adjustments
  private _stabilityThreshold: number = 0.1;

  private constructor() {
    this._curriculumSystem = CurriculumSystem.getInstance();
    this._analyticsSystem = LearningAnalyticsDashboard.getInstance();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): AdaptiveDifficultySystem {
    if (!AdaptiveDifficultySystem._instance) {
      AdaptiveDifficultySystem._instance = new AdaptiveDifficultySystem();
    }
    return AdaptiveDifficultySystem._instance;
  }

  /**
   * Initialize the adaptive difficulty system
   */
  public initialize(): void {
    this._startAdaptationLoop();
    console.log('[AdaptiveDifficultySystem] Initialized adaptive difficulty system');
  }

  /**
   * Start adaptation loop
   */
  private _startAdaptationLoop(): void {
    if (this._adaptationInterval) {
      clearInterval(this._adaptationInterval);
    }

    this._adaptationInterval = setInterval(() => {
      this._runAdaptationCycle();
    }, 15000); // Run every 15 seconds
  }

  /**
   * Initialize player parameters
   */
  public initializePlayerParameters(playerId: string): void {
    if (this._playerParameters.has(playerId)) return;

    const parameters: AdaptiveParameters = {
      playerId,
      currentDifficulty: DifficultyLevel.BEGINNER,
      targetAccuracy: 0.75,
      responseTimeThreshold: 10000,
      streakBonus: 0,
      adaptationRate: 0.1,
      recentPerformance: {
        windowSize: this._performanceWindowSize,
        questions: [],
        accuracy: 0,
        averageResponseTime: 0,
        consistencyScore: 0,
        topicDistribution: new Map()
      },
      topicDifficulties: new Map(),
      lastAdjustment: new Date(),
      adjustmentHistory: []
    };

    // Initialize topic difficulties
    Object.values(MathTopic).forEach(topic => {
      parameters.topicDifficulties.set(topic, {
        topic,
        currentLevel: DifficultyLevel.BEGINNER,
        mastery: 0,
        recentAccuracy: 0,
        averageResponseTime: 0,
        adjustmentCount: 0,
        lastAdjustment: new Date(),
        isStable: false
      });
    });

    this._playerParameters.set(playerId, parameters);
    console.log(`[AdaptiveDifficultySystem] Initialized parameters for player ${playerId}`);
  }

  /**
   * Record question attempt
   */
  public recordQuestionAttempt(
    playerId: string,
    questionId: string,
    topic: MathTopic,
    difficulty: DifficultyLevel,
    isCorrect: boolean,
    responseTime: number,
    confidence?: number
  ): void {
    const parameters = this._playerParameters.get(playerId);
    if (!parameters) return;

    const attempt: QuestionAttempt = {
      questionId,
      topic,
      difficulty,
      isCorrect,
      responseTime,
      timestamp: new Date(),
      playerConfidence: confidence
    };

    // Add to performance window
    parameters.recentPerformance.questions.push(attempt);
    
    // Keep only the most recent attempts
    if (parameters.recentPerformance.questions.length > this._performanceWindowSize) {
      parameters.recentPerformance.questions.shift();
    }

    // Update performance metrics
    this._updatePerformanceMetrics(parameters);

    // Update topic difficulty
    this._updateTopicDifficulty(parameters, topic, isCorrect, responseTime);

    // Check if immediate adjustment is needed
    this._checkImmediateAdjustment(parameters);

    console.log(`[AdaptiveDifficultySystem] Recorded attempt for player ${playerId}: ${topic} (${difficulty}) - ${isCorrect ? 'correct' : 'wrong'}`);
  }

  /**
   * Update performance metrics
   */
  private _updatePerformanceMetrics(parameters: AdaptiveParameters): void {
    const window = parameters.recentPerformance;
    const questions = window.questions;
    
    if (questions.length === 0) return;

    // Calculate accuracy
    const correctCount = questions.filter(q => q.isCorrect).length;
    window.accuracy = correctCount / questions.length;

    // Calculate average response time
    const totalTime = questions.reduce((sum, q) => sum + q.responseTime, 0);
    window.averageResponseTime = totalTime / questions.length;

    // Calculate consistency score
    const accuracies = questions.map(q => q.isCorrect ? 1 : 0);
    const avgAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracies.length;
    window.consistencyScore = Math.max(0, 1 - variance);

    // Update topic distribution
    window.topicDistribution.clear();
    questions.forEach(q => {
      const count = window.topicDistribution.get(q.topic) || 0;
      window.topicDistribution.set(q.topic, count + 1);
    });
  }

  /**
   * Update topic difficulty
   */
  private _updateTopicDifficulty(
    parameters: AdaptiveParameters,
    topic: MathTopic,
    isCorrect: boolean,
    responseTime: number
  ): void {
    let topicDifficulty = parameters.topicDifficulties.get(topic);
    if (!topicDifficulty) {
      topicDifficulty = {
        topic,
        currentLevel: DifficultyLevel.BEGINNER,
        mastery: 0,
        recentAccuracy: 0,
        averageResponseTime: 0,
        adjustmentCount: 0,
        lastAdjustment: new Date(),
        isStable: false
      };
      parameters.topicDifficulties.set(topic, topicDifficulty);
    }

    // Update mastery (exponential moving average)
    const alpha = 0.1;
    topicDifficulty.mastery = alpha * (isCorrect ? 1 : 0) + (1 - alpha) * topicDifficulty.mastery;

    // Update recent accuracy
    const topicQuestions = parameters.recentPerformance.questions.filter(q => q.topic === topic);
    if (topicQuestions.length > 0) {
      const correctCount = topicQuestions.filter(q => q.isCorrect).length;
      topicDifficulty.recentAccuracy = correctCount / topicQuestions.length;
      
      const totalTime = topicQuestions.reduce((sum, q) => sum + q.responseTime, 0);
      topicDifficulty.averageResponseTime = totalTime / topicQuestions.length;
    }

    // Check stability
    topicDifficulty.isStable = topicQuestions.length >= 5 && 
      Math.abs(topicDifficulty.recentAccuracy - parameters.targetAccuracy) < this._stabilityThreshold;
  }

  /**
   * Check if immediate adjustment is needed
   */
  private _checkImmediateAdjustment(parameters: AdaptiveParameters): void {
    const now = new Date();
    const timeSinceLastAdjustment = now.getTime() - parameters.lastAdjustment.getTime();
    
    // Don't adjust too frequently
    if (timeSinceLastAdjustment < this._minAdjustmentInterval) return;

    const window = parameters.recentPerformance;
    
    // Check for immediate adjustment triggers
    if (window.questions.length >= 3) {
      const recentQuestions = window.questions.slice(-3);
      const recentAccuracy = recentQuestions.filter(q => q.isCorrect).length / recentQuestions.length;
      
      // Too easy - 3 consecutive correct answers with fast response
      if (recentAccuracy === 1 && 
          recentQuestions.every(q => q.responseTime < parameters.responseTimeThreshold * 0.5)) {
        this._adjustDifficulty(parameters, AdjustmentReason.HIGH_ACCURACY, 0.5);
      }
      
      // Too hard - 3 consecutive wrong answers
      if (recentAccuracy === 0) {
        this._adjustDifficulty(parameters, AdjustmentReason.LOW_ACCURACY, -0.5);
      }
    }
  }

  /**
   * Run adaptation cycle
   */
  private _runAdaptationCycle(): void {
    this._playerParameters.forEach((parameters, playerId) => {
      this._analyzeAndAdaptDifficulty(parameters);
    });
  }

  /**
   * Analyze and adapt difficulty
   */
  private _analyzeAndAdaptDifficulty(parameters: AdaptiveParameters): void {
    const window = parameters.recentPerformance;
    
    // Need sufficient data for analysis
    if (window.questions.length < 5) return;

    const recommendations = this._generateAdaptiveRecommendations(parameters);
    
    // Apply the highest priority recommendation
    const topRecommendation = recommendations.sort((a, b) => b.priority - a.priority)[0];
    
    if (topRecommendation && topRecommendation.confidence > 0.7) {
      this._applyRecommendation(parameters, topRecommendation);
    }
  }

  /**
   * Generate adaptive recommendations
   */
  private _generateAdaptiveRecommendations(parameters: AdaptiveParameters): AdaptiveRecommendation[] {
    const recommendations: AdaptiveRecommendation[] = [];
    const window = parameters.recentPerformance;

    // Overall difficulty adjustment
    if (window.accuracy > parameters.targetAccuracy + 0.15) {
      recommendations.push({
        type: 'increase',
        topic: MathTopic.BASIC_ARITHMETIC,
        targetDifficulty: this._getNextDifficultyLevel(parameters.currentDifficulty, 1),
        confidence: Math.min(0.9, (window.accuracy - parameters.targetAccuracy) * 2),
        reason: `High accuracy (${Math.round(window.accuracy * 100)}%) suggests content is too easy`,
        priority: 8,
        estimatedImpact: 0.6
      });
    }

    if (window.accuracy < parameters.targetAccuracy - 0.15) {
      recommendations.push({
        type: 'decrease',
        topic: MathTopic.BASIC_ARITHMETIC,
        targetDifficulty: this._getNextDifficultyLevel(parameters.currentDifficulty, -1),
        confidence: Math.min(0.9, (parameters.targetAccuracy - window.accuracy) * 2),
        reason: `Low accuracy (${Math.round(window.accuracy * 100)}%) suggests content is too difficult`,
        priority: 9,
        estimatedImpact: 0.7
      });
    }

    // Response time adjustments
    if (window.averageResponseTime < parameters.responseTimeThreshold * 0.4) {
      recommendations.push({
        type: 'increase',
        topic: MathTopic.BASIC_ARITHMETIC,
        targetDifficulty: this._getNextDifficultyLevel(parameters.currentDifficulty, 1),
        confidence: 0.6,
        reason: `Fast response time (${Math.round(window.averageResponseTime / 1000)}s) indicates readiness for challenge`,
        priority: 6,
        estimatedImpact: 0.4
      });
    }

    if (window.averageResponseTime > parameters.responseTimeThreshold * 1.5) {
      recommendations.push({
        type: 'decrease',
        topic: MathTopic.BASIC_ARITHMETIC,
        targetDifficulty: this._getNextDifficultyLevel(parameters.currentDifficulty, -1),
        confidence: 0.7,
        reason: `Slow response time (${Math.round(window.averageResponseTime / 1000)}s) suggests difficulty is too high`,
        priority: 7,
        estimatedImpact: 0.5
      });
    }

    // Topic-specific recommendations
    parameters.topicDifficulties.forEach((topicDiff, topic) => {
      if (topicDiff.recentAccuracy > 0.9 && topicDiff.averageResponseTime < parameters.responseTimeThreshold * 0.6) {
        recommendations.push({
          type: 'increase',
          topic,
          targetDifficulty: this._getNextDifficultyLevel(topicDiff.currentLevel, 1),
          confidence: 0.8,
          reason: `Mastery of ${topic} (${Math.round(topicDiff.recentAccuracy * 100)}% accuracy)`,
          priority: 7,
          estimatedImpact: 0.5
        });
      }

      if (topicDiff.recentAccuracy < 0.5) {
        recommendations.push({
          type: 'decrease',
          topic,
          targetDifficulty: this._getNextDifficultyLevel(topicDiff.currentLevel, -1),
          confidence: 0.9,
          reason: `Struggling with ${topic} (${Math.round(topicDiff.recentAccuracy * 100)}% accuracy)`,
          priority: 10,
          estimatedImpact: 0.8
        });
      }
    });

    // Consistency-based recommendations
    if (window.consistencyScore < 0.3) {
      recommendations.push({
        type: 'maintain',
        topic: MathTopic.BASIC_ARITHMETIC,
        targetDifficulty: parameters.currentDifficulty,
        confidence: 0.7,
        reason: `Inconsistent performance suggests need for stability`,
        priority: 8,
        estimatedImpact: 0.6
      });
    }

    return recommendations;
  }

  /**
   * Apply recommendation
   */
  private _applyRecommendation(parameters: AdaptiveParameters, recommendation: AdaptiveRecommendation): void {
    const now = new Date();
    const timeSinceLastAdjustment = now.getTime() - parameters.lastAdjustment.getTime();
    
    // Don't adjust too frequently
    if (timeSinceLastAdjustment < this._minAdjustmentInterval) return;

    let adjustmentReason: AdjustmentReason;
    let adjustmentMagnitude: number;

    switch (recommendation.type) {
      case 'increase':
        adjustmentReason = AdjustmentReason.HIGH_ACCURACY;
        adjustmentMagnitude = 1;
        break;
      case 'decrease':
        adjustmentReason = AdjustmentReason.LOW_ACCURACY;
        adjustmentMagnitude = -1;
        break;
      case 'maintain':
        adjustmentReason = AdjustmentReason.INCONSISTENT_PERFORMANCE;
        adjustmentMagnitude = 0;
        break;
      default:
        return;
    }

    this._adjustDifficulty(parameters, adjustmentReason, adjustmentMagnitude);
  }

  /**
   * Adjust difficulty
   */
  private _adjustDifficulty(
    parameters: AdaptiveParameters,
    reason: AdjustmentReason,
    magnitude: number
  ): void {
    const oldDifficulty = parameters.currentDifficulty;
    let newDifficulty = oldDifficulty;

    if (magnitude > 0) {
      newDifficulty = this._getNextDifficultyLevel(oldDifficulty, 1);
    } else if (magnitude < 0) {
      newDifficulty = this._getNextDifficultyLevel(oldDifficulty, -1);
    }

    if (newDifficulty !== oldDifficulty) {
      parameters.currentDifficulty = newDifficulty;
      parameters.lastAdjustment = new Date();

      // Record adjustment
      const adjustment: DifficultyAdjustment = {
        timestamp: new Date(),
        fromDifficulty: oldDifficulty,
        toDifficulty: newDifficulty,
        topic: MathTopic.BASIC_ARITHMETIC,
        reason,
        performanceData: {
          accuracy: parameters.recentPerformance.accuracy,
          responseTime: parameters.recentPerformance.averageResponseTime,
          streak: 0,
          confidence: 0.5
        },
        adjustmentMagnitude: magnitude
      };

      parameters.adjustmentHistory.push(adjustment);
      
      // Keep only recent adjustments
      if (parameters.adjustmentHistory.length > 20) {
        parameters.adjustmentHistory.shift();
      }

      console.log(`[AdaptiveDifficultySystem] Adjusted difficulty for player ${parameters.playerId}: ${oldDifficulty} → ${newDifficulty} (${reason})`);
    }
  }

  /**
   * Get next difficulty level
   */
  private _getNextDifficultyLevel(current: DifficultyLevel, direction: number): DifficultyLevel {
    const levels = [DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.ADVANCED, DifficultyLevel.EXPERT];
    const currentIndex = levels.indexOf(current);
    const newIndex = Math.max(0, Math.min(levels.length - 1, currentIndex + direction));
    return levels[newIndex];
  }

  /**
   * Get optimal difficulty for player
   */
  public getOptimalDifficulty(playerId: string, topic?: MathTopic): DifficultyLevel {
    const parameters = this._playerParameters.get(playerId);
    if (!parameters) return DifficultyLevel.BEGINNER;

    if (topic) {
      const topicDifficulty = parameters.topicDifficulties.get(topic);
      if (topicDifficulty) {
        return topicDifficulty.currentLevel;
      }
    }

    return parameters.currentDifficulty;
  }

  /**
   * Get adaptive questions for player
   */
  public getAdaptiveQuestions(playerId: string, count: number = 10): MathQuestion[] {
    const parameters = this._playerParameters.get(playerId);
    if (!parameters) return [];

    const curriculumQuestions = this._curriculumSystem.getQuestionsForPlayer(playerId, count * 2);
    const adaptedQuestions: MathQuestion[] = [];

    // Filter questions based on adaptive difficulty
    curriculumQuestions.forEach(question => {
      const optimalDifficulty = this.getOptimalDifficulty(playerId, question.topic);
      
      if (question.difficulty === optimalDifficulty || 
          this._isDifficultyClose(question.difficulty, optimalDifficulty)) {
        adaptedQuestions.push(question);
      }
    });

    return adaptedQuestions.slice(0, count);
  }

  /**
   * Check if difficulties are close enough
   */
  private _isDifficultyClose(questionDifficulty: DifficultyLevel, targetDifficulty: DifficultyLevel): boolean {
    const levels = [DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.ADVANCED, DifficultyLevel.EXPERT];
    const questionIndex = levels.indexOf(questionDifficulty);
    const targetIndex = levels.indexOf(targetDifficulty);
    
    return Math.abs(questionIndex - targetIndex) <= 1;
  }

  /**
   * Get player parameters
   */
  public getPlayerParameters(playerId: string): AdaptiveParameters | null {
    return this._playerParameters.get(playerId) || null;
  }

  /**
   * Get adaptation history
   */
  public getAdaptationHistory(playerId: string): DifficultyAdjustment[] {
    const parameters = this._playerParameters.get(playerId);
    return parameters ? parameters.adjustmentHistory : [];
  }

  /**
   * Reset player parameters
   */
  public resetPlayerParameters(playerId: string): void {
    this._playerParameters.delete(playerId);
    console.log(`[AdaptiveDifficultySystem] Reset parameters for player ${playerId}`);
  }

  /**
   * Get system statistics
   */
  public getSystemStats(): object {
    const totalPlayers = this._playerParameters.size;
    const totalAdjustments = Array.from(this._playerParameters.values())
      .reduce((sum, params) => sum + params.adjustmentHistory.length, 0);
    
    const difficultyDistribution = new Map<DifficultyLevel, number>();
    this._playerParameters.forEach(params => {
      const count = difficultyDistribution.get(params.currentDifficulty) || 0;
      difficultyDistribution.set(params.currentDifficulty, count + 1);
    });

    return {
      totalPlayers,
      totalAdjustments,
      difficultyDistribution: Object.fromEntries(difficultyDistribution),
      averageAdaptationRate: totalPlayers > 0 ? totalAdjustments / totalPlayers : 0
    };
  }

  /**
   * Cleanup adaptive difficulty system
   */
  public cleanup(): void {
    if (this._adaptationInterval) {
      clearInterval(this._adaptationInterval);
      this._adaptationInterval = null;
    }

    this._playerParameters.clear();
    console.log('[AdaptiveDifficultySystem] Cleaned up adaptive difficulty system');
  }
}