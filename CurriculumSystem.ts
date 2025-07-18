import { PlayerEntity } from 'hytopia';

/**
 * Math Topic Enumeration
 */
export enum MathTopic {
  BASIC_ARITHMETIC = "arithmetic",
  FRACTIONS = "fractions",
  DECIMALS = "decimals",
  WORD_PROBLEMS = "word_problems",
  GEOMETRY = "geometry",
  ALGEBRA = "algebra"
}

/**
 * Difficulty Level Enumeration
 */
export enum DifficultyLevel {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
  EXPERT = "expert"
}

/**
 * Question Type Interface
 */
export interface MathQuestion {
  id: string;
  topic: MathTopic;
  difficulty: DifficultyLevel;
  question: string;
  correctAnswer: number;
  wrongAnswers: number[];
  explanation?: string;
  timeLimit?: number;
  grade: number;
}

/**
 * Progression Criteria Interface
 */
export interface ProgressionCriteria {
  minAccuracy: number;
  minQuestionsAnswered: number;
  maxTimePerQuestion: number;
  streakRequirement: number;
}

/**
 * Curriculum Level Interface
 */
export interface CurriculumLevel {
  grade: number;
  topics: MathTopic[];
  progressionRequirements: ProgressionCriteria;
  difficultyLevel: DifficultyLevel;
  description: string;
}

/**
 * Player Progress Interface
 */
export interface PlayerProgress {
  playerId: string;
  currentGrade: number;
  currentTopic: MathTopic;
  topicProgress: Map<MathTopic, TopicProgress>;
  totalQuestionsAnswered: number;
  totalCorrectAnswers: number;
  overallAccuracy: number;
  currentStreak: number;
  longestStreak: number;
  averageResponseTime: number;
  lastPlayedDate: Date;
}

/**
 * Topic Progress Interface
 */
export interface TopicProgress {
  topic: MathTopic;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  averageTime: number;
  currentStreak: number;
  bestStreak: number;
  isUnlocked: boolean;
  isCompleted: boolean;
  difficultyLevel: DifficultyLevel;
}

/**
 * Curriculum System - Manages educational content and progression
 */
export class CurriculumSystem {
  private static _instance: CurriculumSystem;
  private _curriculumLevels: Map<number, CurriculumLevel> = new Map();
  private _playerProgress: Map<string, PlayerProgress> = new Map();
  private _questionBank: Map<string, MathQuestion[]> = new Map();
  private _currentQuestions: Map<string, MathQuestion[]> = new Map();

  private constructor() {
    this._initializeCurriculumLevels();
    this._initializeQuestionBank();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): CurriculumSystem {
    if (!CurriculumSystem._instance) {
      CurriculumSystem._instance = new CurriculumSystem();
    }
    return CurriculumSystem._instance;
  }

  /**
   * Initialize curriculum levels
   */
  private _initializeCurriculumLevels(): void {
    // Grade 1-2: Basic Arithmetic
    this._curriculumLevels.set(1, {
      grade: 1,
      topics: [MathTopic.BASIC_ARITHMETIC],
      progressionRequirements: {
        minAccuracy: 0.7,
        minQuestionsAnswered: 20,
        maxTimePerQuestion: 15000,
        streakRequirement: 5
      },
      difficultyLevel: DifficultyLevel.BEGINNER,
      description: "Basic addition and subtraction with numbers 1-10"
    });

    // Grade 3-4: Extended Arithmetic
    this._curriculumLevels.set(3, {
      grade: 3,
      topics: [MathTopic.BASIC_ARITHMETIC, MathTopic.FRACTIONS],
      progressionRequirements: {
        minAccuracy: 0.75,
        minQuestionsAnswered: 30,
        maxTimePerQuestion: 12000,
        streakRequirement: 7
      },
      difficultyLevel: DifficultyLevel.INTERMEDIATE,
      description: "Multiplication, division, and basic fractions"
    });

    // Grade 5-6: Advanced Operations
    this._curriculumLevels.set(5, {
      grade: 5,
      topics: [MathTopic.BASIC_ARITHMETIC, MathTopic.FRACTIONS, MathTopic.DECIMALS],
      progressionRequirements: {
        minAccuracy: 0.8,
        minQuestionsAnswered: 40,
        maxTimePerQuestion: 10000,
        streakRequirement: 10
      },
      difficultyLevel: DifficultyLevel.ADVANCED,
      description: "Complex fractions, decimals, and word problems"
    });

    // Grade 7-8: Pre-Algebra
    this._curriculumLevels.set(7, {
      grade: 7,
      topics: [MathTopic.BASIC_ARITHMETIC, MathTopic.FRACTIONS, MathTopic.DECIMALS, MathTopic.WORD_PROBLEMS, MathTopic.GEOMETRY],
      progressionRequirements: {
        minAccuracy: 0.85,
        minQuestionsAnswered: 50,
        maxTimePerQuestion: 8000,
        streakRequirement: 12
      },
      difficultyLevel: DifficultyLevel.EXPERT,
      description: "Advanced word problems and basic geometry"
    });

    console.log('[CurriculumSystem] Initialized curriculum levels for grades 1-8');
  }

  /**
   * Initialize question bank
   */
  private _initializeQuestionBank(): void {
    // Basic Arithmetic Questions
    this._addQuestionsToBank(MathTopic.BASIC_ARITHMETIC, [
      // Grade 1 - Simple addition
      { id: 'arith_1_1', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '3 + 2 = ?', correctAnswer: 5, wrongAnswers: [3, 4, 6], grade: 1 },
      { id: 'arith_1_2', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '7 - 3 = ?', correctAnswer: 4, wrongAnswers: [3, 5, 10], grade: 1 },
      { id: 'arith_1_3', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '5 + 4 = ?', correctAnswer: 9, wrongAnswers: [8, 10, 1], grade: 1 },
      
      // Grade 3 - Multiplication
      { id: 'arith_3_1', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '6 × 4 = ?', correctAnswer: 24, wrongAnswers: [20, 28, 26], grade: 3 },
      { id: 'arith_3_2', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '35 ÷ 5 = ?', correctAnswer: 7, wrongAnswers: [5, 8, 6], grade: 3 },
      { id: 'arith_3_3', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '8 × 7 = ?', correctAnswer: 56, wrongAnswers: [54, 58, 49], grade: 3 },
      
      // Grade 5 - Advanced arithmetic
      { id: 'arith_5_1', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.ADVANCED, question: '144 ÷ 12 = ?', correctAnswer: 12, wrongAnswers: [11, 13, 14], grade: 5 },
      { id: 'arith_5_2', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.ADVANCED, question: '25 × 16 = ?', correctAnswer: 400, wrongAnswers: [350, 450, 375], grade: 5 },
    ]);

    // Fractions Questions
    this._addQuestionsToBank(MathTopic.FRACTIONS, [
      { id: 'frac_3_1', topic: MathTopic.FRACTIONS, difficulty: DifficultyLevel.INTERMEDIATE, question: '1/2 + 1/4 = ?', correctAnswer: 0.75, wrongAnswers: [0.5, 0.25, 1], grade: 3 },
      { id: 'frac_3_2', topic: MathTopic.FRACTIONS, difficulty: DifficultyLevel.INTERMEDIATE, question: '3/4 - 1/4 = ?', correctAnswer: 0.5, wrongAnswers: [0.25, 0.75, 1], grade: 3 },
      { id: 'frac_5_1', topic: MathTopic.FRACTIONS, difficulty: DifficultyLevel.ADVANCED, question: '2/3 × 3/4 = ?', correctAnswer: 0.5, wrongAnswers: [0.75, 0.25, 1], grade: 5 },
      { id: 'frac_5_2', topic: MathTopic.FRACTIONS, difficulty: DifficultyLevel.ADVANCED, question: '5/6 ÷ 1/3 = ?', correctAnswer: 2.5, wrongAnswers: [1.5, 3.5, 2], grade: 5 },
    ]);

    // Decimals Questions
    this._addQuestionsToBank(MathTopic.DECIMALS, [
      { id: 'dec_5_1', topic: MathTopic.DECIMALS, difficulty: DifficultyLevel.ADVANCED, question: '0.25 + 0.75 = ?', correctAnswer: 1, wrongAnswers: [0.5, 1.5, 0.75], grade: 5 },
      { id: 'dec_5_2', topic: MathTopic.DECIMALS, difficulty: DifficultyLevel.ADVANCED, question: '2.5 × 4 = ?', correctAnswer: 10, wrongAnswers: [8, 12, 6], grade: 5 },
      { id: 'dec_7_1', topic: MathTopic.DECIMALS, difficulty: DifficultyLevel.EXPERT, question: '12.75 ÷ 2.5 = ?', correctAnswer: 5.1, wrongAnswers: [4.8, 5.5, 6.2], grade: 7 },
    ]);

    // Word Problems
    this._addQuestionsToBank(MathTopic.WORD_PROBLEMS, [
      { id: 'word_5_1', topic: MathTopic.WORD_PROBLEMS, difficulty: DifficultyLevel.ADVANCED, question: 'Sarah has 24 apples. She gives 8 to her friend. How many does she have left?', correctAnswer: 16, wrongAnswers: [14, 18, 12], grade: 5 },
      { id: 'word_7_1', topic: MathTopic.WORD_PROBLEMS, difficulty: DifficultyLevel.EXPERT, question: 'A train travels 120 miles in 2 hours. What is its speed in miles per hour?', correctAnswer: 60, wrongAnswers: [50, 70, 80], grade: 7 },
    ]);

    console.log('[CurriculumSystem] Initialized question bank with multiple topics');
  }

  /**
   * Add questions to the question bank
   */
  private _addQuestionsToBank(topic: MathTopic, questions: MathQuestion[]): void {
    if (!this._questionBank.has(topic)) {
      this._questionBank.set(topic, []);
    }
    this._questionBank.get(topic)!.push(...questions);
  }

  /**
   * Initialize player progress
   */
  public initializePlayerProgress(playerId: string): PlayerProgress {
    const progress: PlayerProgress = {
      playerId,
      currentGrade: 1,
      currentTopic: MathTopic.BASIC_ARITHMETIC,
      topicProgress: new Map(),
      totalQuestionsAnswered: 0,
      totalCorrectAnswers: 0,
      overallAccuracy: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageResponseTime: 0,
      lastPlayedDate: new Date()
    };

    // Initialize topic progress for all topics
    Object.values(MathTopic).forEach(topic => {
      const topicProgress: TopicProgress = {
        topic,
        questionsAnswered: 0,
        correctAnswers: 0,
        accuracy: 0,
        averageTime: 0,
        currentStreak: 0,
        bestStreak: 0,
        isUnlocked: topic === MathTopic.BASIC_ARITHMETIC,
        isCompleted: false,
        difficultyLevel: DifficultyLevel.BEGINNER
      };
      progress.topicProgress.set(topic, topicProgress);
    });

    this._playerProgress.set(playerId, progress);
    console.log(`[CurriculumSystem] Initialized progress for player ${playerId}`);
    return progress;
  }

  /**
   * Get player progress
   */
  public getPlayerProgress(playerId: string): PlayerProgress | null {
    return this._playerProgress.get(playerId) || null;
  }

  /**
   * Get questions for player based on their progress
   */
  public getQuestionsForPlayer(playerId: string, count: number = 10): MathQuestion[] {
    const progress = this.getPlayerProgress(playerId);
    if (!progress) {
      console.warn(`[CurriculumSystem] No progress found for player ${playerId}`);
      return [];
    }

    const curriculumLevel = this._curriculumLevels.get(progress.currentGrade);
    if (!curriculumLevel) {
      console.warn(`[CurriculumSystem] No curriculum level found for grade ${progress.currentGrade}`);
      return [];
    }

    const questions: MathQuestion[] = [];
    const availableTopics = curriculumLevel.topics.filter(topic => 
      progress.topicProgress.get(topic)?.isUnlocked || false
    );

    // Get questions from available topics
    for (const topic of availableTopics) {
      const topicQuestions = this._questionBank.get(topic) || [];
      const gradeAppropriateQuestions = topicQuestions.filter(q => 
        q.grade <= progress.currentGrade
      );
      
      questions.push(...gradeAppropriateQuestions);
    }

    // Shuffle and return requested count
    const shuffled = questions.sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, count);
    
    this._currentQuestions.set(playerId, selectedQuestions);
    
    console.log(`[CurriculumSystem] Generated ${selectedQuestions.length} questions for player ${playerId} (Grade ${progress.currentGrade})`);
    return selectedQuestions;
  }

  /**
   * Record player answer
   */
  public recordAnswer(playerId: string, questionId: string, answer: number, responseTime: number): boolean {
    const progress = this.getPlayerProgress(playerId);
    if (!progress) return false;

    const currentQuestions = this._currentQuestions.get(playerId) || [];
    const question = currentQuestions.find(q => q.id === questionId);
    if (!question) return false;

    const isCorrect = answer === question.correctAnswer;
    const topicProgress = progress.topicProgress.get(question.topic);
    if (!topicProgress) return false;

    // Update topic progress
    topicProgress.questionsAnswered++;
    if (isCorrect) {
      topicProgress.correctAnswers++;
      topicProgress.currentStreak++;
      topicProgress.bestStreak = Math.max(topicProgress.bestStreak, topicProgress.currentStreak);
      progress.currentStreak++;
      progress.longestStreak = Math.max(progress.longestStreak, progress.currentStreak);
    } else {
      topicProgress.currentStreak = 0;
      progress.currentStreak = 0;
    }

    // Update accuracy
    topicProgress.accuracy = topicProgress.correctAnswers / topicProgress.questionsAnswered;
    
    // Update average response time
    topicProgress.averageTime = (topicProgress.averageTime * (topicProgress.questionsAnswered - 1) + responseTime) / topicProgress.questionsAnswered;

    // Update overall progress
    progress.totalQuestionsAnswered++;
    if (isCorrect) {
      progress.totalCorrectAnswers++;
    }
    progress.overallAccuracy = progress.totalCorrectAnswers / progress.totalQuestionsAnswered;
    progress.averageResponseTime = (progress.averageResponseTime * (progress.totalQuestionsAnswered - 1) + responseTime) / progress.totalQuestionsAnswered;
    progress.lastPlayedDate = new Date();

    // Check for progression
    this._checkProgression(playerId);

    console.log(`[CurriculumSystem] Recorded answer for player ${playerId}: ${isCorrect ? 'correct' : 'wrong'} (${responseTime}ms)`);
    return isCorrect;
  }

  /**
   * Check if player should progress to next level
   */
  private _checkProgression(playerId: string): void {
    const progress = this.getPlayerProgress(playerId);
    if (!progress) return;

    const currentLevel = this._curriculumLevels.get(progress.currentGrade);
    if (!currentLevel) return;

    const requirements = currentLevel.progressionRequirements;
    
    // Check if player meets progression requirements
    const meetsAccuracy = progress.overallAccuracy >= requirements.minAccuracy;
    const meetsQuestionCount = progress.totalQuestionsAnswered >= requirements.minQuestionsAnswered;
    const meetsTime = progress.averageResponseTime <= requirements.maxTimePerQuestion;
    const meetsStreak = progress.longestStreak >= requirements.streakRequirement;

    if (meetsAccuracy && meetsQuestionCount && meetsTime && meetsStreak) {
      // Progress to next grade
      const nextGrade = progress.currentGrade + 2; // Skip to next curriculum level
      if (this._curriculumLevels.has(nextGrade)) {
        progress.currentGrade = nextGrade;
        
        // Unlock new topics
        const newLevel = this._curriculumLevels.get(nextGrade)!;
        newLevel.topics.forEach(topic => {
          const topicProgress = progress.topicProgress.get(topic);
          if (topicProgress) {
            topicProgress.isUnlocked = true;
          }
        });

        console.log(`[CurriculumSystem] Player ${playerId} progressed to grade ${nextGrade}`);
      }
    }
  }

  /**
   * Get curriculum level information
   */
  public getCurriculumLevel(grade: number): CurriculumLevel | null {
    return this._curriculumLevels.get(grade) || null;
  }

  /**
   * Get all available topics for a grade
   */
  public getTopicsForGrade(grade: number): MathTopic[] {
    const level = this._curriculumLevels.get(grade);
    return level ? level.topics : [];
  }

  /**
   * Get topic progress for a player
   */
  public getTopicProgress(playerId: string, topic: MathTopic): TopicProgress | null {
    const progress = this.getPlayerProgress(playerId);
    if (!progress) return null;
    
    return progress.topicProgress.get(topic) || null;
  }

  /**
   * Get statistics for curriculum system
   */
  public getSystemStats(): {
    totalPlayers: number;
    totalQuestions: number;
    averageGrade: number;
    topicDistribution: Map<MathTopic, number>;
  } {
    const totalPlayers = this._playerProgress.size;
    let totalQuestions = 0;
    let gradeSum = 0;
    const topicDistribution = new Map<MathTopic, number>();

    // Initialize topic distribution
    Object.values(MathTopic).forEach(topic => {
      topicDistribution.set(topic, this._questionBank.get(topic)?.length || 0);
    });

    // Calculate stats
    this._playerProgress.forEach(progress => {
      totalQuestions += progress.totalQuestionsAnswered;
      gradeSum += progress.currentGrade;
    });

    return {
      totalPlayers,
      totalQuestions,
      averageGrade: totalPlayers > 0 ? gradeSum / totalPlayers : 0,
      topicDistribution
    };
  }

  /**
   * Reset player progress
   */
  public resetPlayerProgress(playerId: string): void {
    this._playerProgress.delete(playerId);
    this._currentQuestions.delete(playerId);
    console.log(`[CurriculumSystem] Reset progress for player ${playerId}`);
  }

  /**
   * Cleanup system
   */
  public cleanup(): void {
    this._playerProgress.clear();
    this._currentQuestions.clear();
    console.log('[CurriculumSystem] Cleaned up curriculum system');
  }
}