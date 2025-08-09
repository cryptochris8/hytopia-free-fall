import { PlayerEntity, Player } from 'hytopia';

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
   * Save player curriculum progress to Hytopia persistence
   */
  private async _savePlayerProgress(player: Player, progress: PlayerProgress): Promise<void> {
    try {
      const persistedData = await player.getPersistedData();
      const curriculumData = {
        currentGrade: progress.currentGrade,
        currentTopic: progress.currentTopic,
        totalQuestionsAnswered: progress.totalQuestionsAnswered,
        totalCorrectAnswers: progress.totalCorrectAnswers,
        overallAccuracy: progress.overallAccuracy,
        currentStreak: progress.currentStreak,
        longestStreak: progress.longestStreak,
        averageResponseTime: progress.averageResponseTime,
        lastPlayedDate: progress.lastPlayedDate.toISOString(),
        topicProgress: Array.from(progress.topicProgress.entries()).map(([topic, topicProg]) => ({
          topic,
          questionsAnswered: topicProg.questionsAnswered,
          correctAnswers: topicProg.correctAnswers,
          accuracy: topicProg.accuracy,
          averageTime: topicProg.averageTime,
          currentStreak: topicProg.currentStreak,
          bestStreak: topicProg.bestStreak,
          isUnlocked: topicProg.isUnlocked,
          isCompleted: topicProg.isCompleted,
          difficultyLevel: topicProg.difficultyLevel
        }))
      };

      const updatedData = {
        ...persistedData,
        curriculum: curriculumData
      };

      await player.setPersistedData(updatedData);
      console.log(`[CurriculumSystem] Saved curriculum data for player ${player.id}`);
    } catch (error) {
      console.error(`[CurriculumSystem] Failed to save curriculum data for player ${player.id}:`, error);
    }
  }

  /**
   * Load player curriculum progress from Hytopia persistence
   */
  private async _loadPlayerProgress(player: Player): Promise<PlayerProgress | null> {
    try {
      const persistedData = await player.getPersistedData();
      const curriculumData = persistedData?.curriculum;
      
      if (!curriculumData) {
        return null;
      }

      const topicProgress = new Map<MathTopic, TopicProgress>();
      if (curriculumData.topicProgress) {
        curriculumData.topicProgress.forEach((topicProg: any) => {
          topicProgress.set(topicProg.topic, {
            topic: topicProg.topic,
            questionsAnswered: topicProg.questionsAnswered || 0,
            correctAnswers: topicProg.correctAnswers || 0,
            accuracy: topicProg.accuracy || 0,
            averageTime: topicProg.averageTime || 0,
            currentStreak: topicProg.currentStreak || 0,
            bestStreak: topicProg.bestStreak || 0,
            isUnlocked: topicProg.isUnlocked || false,
            isCompleted: topicProg.isCompleted || false,
            difficultyLevel: topicProg.difficultyLevel || DifficultyLevel.BEGINNER
          });
        });
      }

      const progress: PlayerProgress = {
        playerId: player.id,
        currentGrade: curriculumData.currentGrade || 1,
        currentTopic: curriculumData.currentTopic || MathTopic.BASIC_ARITHMETIC,
        topicProgress,
        totalQuestionsAnswered: curriculumData.totalQuestionsAnswered || 0,
        totalCorrectAnswers: curriculumData.totalCorrectAnswers || 0,
        overallAccuracy: curriculumData.overallAccuracy || 0,
        currentStreak: curriculumData.currentStreak || 0,
        longestStreak: curriculumData.longestStreak || 0,
        averageResponseTime: curriculumData.averageResponseTime || 0,
        lastPlayedDate: curriculumData.lastPlayedDate ? 
          new Date(curriculumData.lastPlayedDate) : new Date()
      };

      console.log(`[CurriculumSystem] Loaded curriculum data for player ${player.id}`);
      return progress;
    } catch (error) {
      console.error(`[CurriculumSystem] Failed to load curriculum data for player ${player.id}:`, error);
      return null;
    }
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
    // Basic Arithmetic Questions (All answers 0-15 to match available blocks)
    this._addQuestionsToBank(MathTopic.BASIC_ARITHMETIC, [
      // Grade 1 - Addition (0-15 range)
      { id: 'arith_1_1', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '3 + 2 = ?', correctAnswer: 5, wrongAnswers: [3, 4, 6], grade: 1 },
      { id: 'arith_1_2', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '7 + 3 = ?', correctAnswer: 10, wrongAnswers: [8, 9, 11], grade: 1 },
      { id: 'arith_1_3', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '5 + 4 = ?', correctAnswer: 9, wrongAnswers: [8, 10, 7], grade: 1 },
      { id: 'arith_1_4', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '6 + 7 = ?', correctAnswer: 13, wrongAnswers: [12, 14, 15], grade: 1 },
      { id: 'arith_1_5', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '8 + 5 = ?', correctAnswer: 13, wrongAnswers: [11, 12, 14], grade: 1 },
      { id: 'arith_1_6', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '9 + 6 = ?', correctAnswer: 15, wrongAnswers: [13, 14, 12], grade: 1 },
      
      // Grade 1 - Subtraction (0-15 range)
      { id: 'arith_1_7', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '7 - 3 = ?', correctAnswer: 4, wrongAnswers: [3, 5, 2], grade: 1 },
      { id: 'arith_1_8', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '10 - 4 = ?', correctAnswer: 6, wrongAnswers: [5, 7, 8], grade: 1 },
      { id: 'arith_1_9', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '12 - 8 = ?', correctAnswer: 4, wrongAnswers: [3, 5, 6], grade: 1 },
      { id: 'arith_1_10', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '15 - 7 = ?', correctAnswer: 8, wrongAnswers: [7, 9, 6], grade: 1 },
      { id: 'arith_1_11', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '11 - 5 = ?', correctAnswer: 6, wrongAnswers: [5, 7, 4], grade: 1 },
      { id: 'arith_1_12', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '14 - 9 = ?', correctAnswer: 5, wrongAnswers: [4, 6, 3], grade: 1 },
      
      // Grade 1 - Simple multiplication (0-15 range)
      { id: 'arith_1_13', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '3 × 2 = ?', correctAnswer: 6, wrongAnswers: [5, 7, 4], grade: 1 },
      { id: 'arith_1_14', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '4 × 3 = ?', correctAnswer: 12, wrongAnswers: [11, 13, 10], grade: 1 },
      { id: 'arith_1_15', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '5 × 2 = ?', correctAnswer: 10, wrongAnswers: [8, 9, 11], grade: 1 },
      { id: 'arith_1_16', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '3 × 4 = ?', correctAnswer: 12, wrongAnswers: [10, 14, 15], grade: 1 },
      { id: 'arith_1_17', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '2 × 7 = ?', correctAnswer: 14, wrongAnswers: [12, 13, 15], grade: 1 },
      { id: 'arith_1_18', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '3 × 5 = ?', correctAnswer: 15, wrongAnswers: [13, 14, 12], grade: 1 },
      
      // Grade 1 - Simple division (0-15 range)
      { id: 'arith_1_19', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '6 ÷ 2 = ?', correctAnswer: 3, wrongAnswers: [2, 4, 5], grade: 1 },
      { id: 'arith_1_20', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '8 ÷ 4 = ?', correctAnswer: 2, wrongAnswers: [1, 3, 4], grade: 1 },
      { id: 'arith_1_21', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '12 ÷ 3 = ?', correctAnswer: 4, wrongAnswers: [3, 5, 6], grade: 1 },
      { id: 'arith_1_22', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '15 ÷ 5 = ?', correctAnswer: 3, wrongAnswers: [2, 4, 5], grade: 1 },
      { id: 'arith_1_23', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '10 ÷ 2 = ?', correctAnswer: 5, wrongAnswers: [4, 6, 3], grade: 1 },
      { id: 'arith_1_24', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.BEGINNER, question: '14 ÷ 7 = ?', correctAnswer: 2, wrongAnswers: [1, 3, 4], grade: 1 },
      
      // Grade 3 - Mixed operations (0-15 range)
      { id: 'arith_3_1', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '2 × 6 = ?', correctAnswer: 12, wrongAnswers: [10, 14, 11], grade: 3 },
      { id: 'arith_3_2', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '9 ÷ 3 = ?', correctAnswer: 3, wrongAnswers: [2, 4, 6], grade: 3 },
      { id: 'arith_3_3', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '3 × 5 = ?', correctAnswer: 15, wrongAnswers: [12, 13, 14], grade: 3 },
      { id: 'arith_3_4', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '15 ÷ 3 = ?', correctAnswer: 5, wrongAnswers: [4, 6, 3], grade: 3 },
      { id: 'arith_3_5', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '7 + 8 = ?', correctAnswer: 15, wrongAnswers: [13, 14, 12], grade: 3 },
      { id: 'arith_3_6', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '15 - 9 = ?', correctAnswer: 6, wrongAnswers: [5, 7, 8], grade: 3 },
      { id: 'arith_3_7', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '4 × 3 = ?', correctAnswer: 12, wrongAnswers: [10, 11, 14], grade: 3 },
      { id: 'arith_3_8', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.INTERMEDIATE, question: '14 ÷ 2 = ?', correctAnswer: 7, wrongAnswers: [6, 8, 5], grade: 3 },
      
      // Grade 5 - Advanced arithmetic (0-15 range only)
      { id: 'arith_5_1', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.ADVANCED, question: '15 ÷ 5 = ?', correctAnswer: 3, wrongAnswers: [2, 4, 5], grade: 5 },
      { id: 'arith_5_2', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.ADVANCED, question: '4 × 3 + 2 = ?', correctAnswer: 14, wrongAnswers: [12, 13, 15], grade: 5 },
      { id: 'arith_5_3', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.ADVANCED, question: '15 - 7 = ?', correctAnswer: 8, wrongAnswers: [7, 9, 6], grade: 5 },
      { id: 'arith_5_4', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.ADVANCED, question: '2 × 7 = ?', correctAnswer: 14, wrongAnswers: [12, 13, 15], grade: 5 },
      { id: 'arith_5_5', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.ADVANCED, question: '12 ÷ 4 = ?', correctAnswer: 3, wrongAnswers: [2, 4, 6], grade: 5 },
      { id: 'arith_5_6', topic: MathTopic.BASIC_ARITHMETIC, difficulty: DifficultyLevel.ADVANCED, question: '5 × 3 = ?', correctAnswer: 15, wrongAnswers: [12, 13, 14], grade: 5 },
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
   * Initialize player progress with persistence support
   */
  public async initializePlayerProgress(player: Player): Promise<PlayerProgress> {
    // Check if progress already exists in memory
    const existingProgress = this._playerProgress.get(player.id);
    if (existingProgress) {
      return existingProgress;
    }

    // Try to load existing progress from persistence
    const loadedProgress = await this._loadPlayerProgress(player);
    
    if (loadedProgress) {
      // Ensure all topics are present (in case new topics were added)
      Object.values(MathTopic).forEach(topic => {
        if (!loadedProgress.topicProgress.has(topic)) {
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
          loadedProgress.topicProgress.set(topic, topicProgress);
        }
      });
      
      this._playerProgress.set(player.id, loadedProgress);
      console.log(`[CurriculumSystem] Loaded existing progress for player ${player.id}`);
      return loadedProgress;
    }

    // Create new progress if none exists
    const progress: PlayerProgress = {
      playerId: player.id,
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

    this._playerProgress.set(player.id, progress);
    
    // Save initial progress
    await this._savePlayerProgress(player, progress);
    console.log(`[CurriculumSystem] Initialized new progress for player ${player.id}`);
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
   * Record player answer with automatic persistence
   */
  public async recordAnswer(player: Player, questionId: string, answer: number, responseTime: number): Promise<boolean> {
    const progress = this.getPlayerProgress(player.id);
    if (!progress) return false;

    const currentQuestions = this._currentQuestions.get(player.id) || [];
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
    this._checkProgression(player.id);

    // Save progress periodically (every few answers to avoid excessive saves)
    if (progress.totalQuestionsAnswered % 3 === 0 || isCorrect && progress.currentStreak % 5 === 0) {
      await this._savePlayerProgress(player, progress);
    }

    console.log(`[CurriculumSystem] Recorded answer for player ${player.id}: ${isCorrect ? 'correct' : 'wrong'} (${responseTime}ms)`);
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