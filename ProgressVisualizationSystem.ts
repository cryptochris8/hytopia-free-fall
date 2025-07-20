import { PlayerEntity, World, Entity, Vector3Like, RigidBodyType, ColliderShape } from 'hytopia';
import { CurriculumSystem, MathTopic, PlayerProgress, TopicProgress } from './CurriculumSystem';
import { LearningAnalyticsDashboard, PerformanceMetrics } from './LearningAnalyticsDashboard';
import { AchievementSystem, AchievementNotification } from './AchievementSystem';
import { AdaptiveDifficultySystem } from './AdaptiveDifficultySystem';

/**
 * Visualization Types
 */
export enum VisualizationType {
  PROGRESS_BAR = "progress_bar",
  SKILL_TREE = "skill_tree",
  PERFORMANCE_CHART = "performance_chart",
  ACHIEVEMENT_BOARD = "achievement_board",
  STREAK_COUNTER = "streak_counter",
  TOPIC_MASTERY = "topic_mastery",
  DIFFICULTY_LADDER = "difficulty_ladder"
}

/**
 * Visual Element Interface
 */
export interface VisualElement {
  id: string;
  type: VisualizationType;
  position: Vector3Like;
  data: any;
  entity?: Entity;
  isActive: boolean;
  lastUpdate: Date;
  animationState?: string;
}

/**
 * Progress Visualization Configuration
 */
export interface VisualizationConfig {
  playerId: string;
  enabledVisuals: Set<VisualizationType>;
  updateInterval: number;
  animationSpeed: number;
  colorScheme: ColorScheme;
  displayMode: 'floating' | 'hud' | 'world';
  autoHide: boolean;
  autoHideDelay: number;
}

/**
 * Color Scheme Interface
 */
export interface ColorScheme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  text: string;
}

/**
 * Progress Data Interface
 */
export interface ProgressData {
  playerId: string;
  overallProgress: number;
  topicProgress: Map<MathTopic, number>;
  currentStreak: number;
  bestStreak: number;
  accuracy: number;
  questionsAnswered: number;
  currentGrade: number;
  achievementPoints: number;
  recentImprovements: string[];
  nextMilestones: string[];
}

/**
 * Animation State Interface
 */
export interface AnimationState {
  elementId: string;
  animationType: 'pulse' | 'glow' | 'rotate' | 'scale' | 'float';
  startTime: Date;
  duration: number;
  isLooping: boolean;
  currentFrame: number;
}

/**
 * Progress Visualization System - Creates visual representations of player progress
 */
export class ProgressVisualizationSystem {
  private static _instance: ProgressVisualizationSystem;
  private _world: World | null = null;
  private _curriculumSystem: CurriculumSystem;
  private _analyticsSystem: LearningAnalyticsDashboard;
  private _achievementSystem: AchievementSystem;
  private _adaptiveSystem: AdaptiveDifficultySystem;
  private _playerConfigs: Map<string, VisualizationConfig> = new Map();
  private _visualElements: Map<string, VisualElement[]> = new Map();
  private _animationStates: Map<string, AnimationState[]> = new Map();
  private _updateInterval: NodeJS.Timeout | null = null;
  private _defaultColorScheme: ColorScheme;

  private constructor() {
    this._curriculumSystem = CurriculumSystem.getInstance();
    this._analyticsSystem = LearningAnalyticsDashboard.getInstance();
    this._achievementSystem = AchievementSystem.getInstance();
    this._adaptiveSystem = AdaptiveDifficultySystem.getInstance();
    
    this._defaultColorScheme = {
      primary: "#3498db",
      secondary: "#2ecc71",
      success: "#27ae60",
      warning: "#f39c12",
      error: "#e74c3c",
      background: "#ecf0f1",
      text: "#2c3e50"
    };
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ProgressVisualizationSystem {
    if (!ProgressVisualizationSystem._instance) {
      ProgressVisualizationSystem._instance = new ProgressVisualizationSystem();
    }
    return ProgressVisualizationSystem._instance;
  }

  /**
   * Initialize the visualization system
   */
  public initialize(world: World): void {
    this._world = world;
    this._startUpdateLoop();
    console.log('[ProgressVisualizationSystem] Initialized progress visualization system');
  }

  /**
   * Start update loop
   */
  private _startUpdateLoop(): void {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
    }

    this._updateInterval = setInterval(() => {
      this._updateAllVisualizations();
    }, 2000); // Update every 2 seconds
  }

  /**
   * Initialize player visualization
   */
  public initializePlayerVisualization(playerId: string): void {
    if (this._playerConfigs.has(playerId)) return;

    const config: VisualizationConfig = {
      playerId,
      enabledVisuals: new Set([
        VisualizationType.PROGRESS_BAR,
        VisualizationType.STREAK_COUNTER,
        VisualizationType.TOPIC_MASTERY,
        VisualizationType.ACHIEVEMENT_BOARD
      ]),
      updateInterval: 2000,
      animationSpeed: 1.0,
      colorScheme: this._defaultColorScheme,
      displayMode: 'floating',
      autoHide: false,
      autoHideDelay: 10000
    };

    this._playerConfigs.set(playerId, config);
    this._visualElements.set(playerId, []);
    this._animationStates.set(playerId, []);

    console.log(`[ProgressVisualizationSystem] Initialized visualization for player ${playerId}`);
  }

  /**
   * Update all visualizations
   */
  private _updateAllVisualizations(): void {
    this._playerConfigs.forEach((config, playerId) => {
      this._updatePlayerVisualization(playerId);
    });
  }

  /**
   * Update player visualization
   */
  private _updatePlayerVisualization(playerId: string): void {
    const config = this._playerConfigs.get(playerId);
    if (!config) return;

    const progressData = this._gatherProgressData(playerId);
    if (!progressData) return;

    // Update each enabled visual type
    config.enabledVisuals.forEach(visualType => {
      this._updateVisualElement(playerId, visualType, progressData);
    });

    // Update animations
    this._updateAnimations(playerId);
  }

  /**
   * Gather progress data for player
   */
  private _gatherProgressData(playerId: string): ProgressData | null {
    const progress = this._curriculumSystem.getPlayerProgress(playerId);
    const metrics = this._analyticsSystem.getPerformanceMetrics(playerId);
    const achievements = this._achievementSystem.getPlayerAchievements(playerId);
    
    if (!progress) return null;

    const topicProgress = new Map<MathTopic, number>();
    progress.topicProgress.forEach((topicProg, topic) => {
      topicProgress.set(topic, topicProg.accuracy);
    });

    const progressData: ProgressData = {
      playerId,
      overallProgress: progress.overallAccuracy,
      topicProgress,
      currentStreak: progress.currentStreak,
      bestStreak: progress.longestStreak,
      accuracy: progress.overallAccuracy,
      questionsAnswered: progress.totalQuestionsAnswered,
      currentGrade: progress.currentGrade,
      achievementPoints: achievements?.totalPoints || 0,
      recentImprovements: this._getRecentImprovements(progress, metrics),
      nextMilestones: this._getNextMilestones(progress)
    };

    return progressData;
  }

  /**
   * Get recent improvements
   */
  private _getRecentImprovements(progress: PlayerProgress, metrics: PerformanceMetrics | null): string[] {
    const improvements: string[] = [];

    if (progress.currentStreak > 5) {
      improvements.push(`🔥 ${progress.currentStreak} question streak!`);
    }

    if (progress.overallAccuracy > 0.8) {
      improvements.push(`🎯 ${Math.round(progress.overallAccuracy * 100)}% accuracy`);
    }

    progress.topicProgress.forEach((topicProg, topic) => {
      if (topicProg.accuracy > 0.9) {
        improvements.push(`📚 Mastered ${topic}`);
      }
    });

    return improvements.slice(0, 3);
  }

  /**
   * Get next milestones
   */
  private _getNextMilestones(progress: PlayerProgress): string[] {
    const milestones: string[] = [];

    if (progress.currentStreak < 10) {
      milestones.push(`Reach 10 question streak (${progress.currentStreak}/10)`);
    }

    if (progress.overallAccuracy < 0.9) {
      milestones.push(`Achieve 90% accuracy (${Math.round(progress.overallAccuracy * 100)}%/90%)`);
    }

    const nextGrade = progress.currentGrade + 2;
    if (nextGrade <= 8) {
      milestones.push(`Advance to Grade ${nextGrade}`);
    }

    return milestones.slice(0, 3);
  }

  /**
   * Update visual element
   */
  private _updateVisualElement(playerId: string, visualType: VisualizationType, progressData: ProgressData): void {
    const elements = this._visualElements.get(playerId) || [];
    let element = elements.find(e => e.type === visualType);

    if (!element) {
      element = this._createVisualElement(playerId, visualType, progressData);
      elements.push(element);
      this._visualElements.set(playerId, elements);
    }

    // Update element data
    element.data = this._getElementData(visualType, progressData);
    element.lastUpdate = new Date();

    // Update visual representation
    this._updateElementVisual(element);
  }

  /**
   * Create visual element
   */
  private _createVisualElement(playerId: string, visualType: VisualizationType, progressData: ProgressData): VisualElement {
    const element: VisualElement = {
      id: `${playerId}_${visualType}`,
      type: visualType,
      position: this._getElementPosition(playerId, visualType),
      data: this._getElementData(visualType, progressData),
      isActive: true,
      lastUpdate: new Date()
    };

    // Create physical entity if needed
    if (this._needsPhysicalEntity(visualType)) {
      element.entity = this._createElementEntity(element);
    }

    return element;
  }

  /**
   * Get element position
   */
  private _getElementPosition(playerId: string, visualType: VisualizationType): Vector3Like {
    const basePosition = { x: 0, y: 10, z: 0 };
    const offset = this._getVisualizationOffset(visualType);
    
    return {
      x: basePosition.x + offset.x,
      y: basePosition.y + offset.y,
      z: basePosition.z + offset.z
    };
  }

  /**
   * Get visualization offset
   */
  private _getVisualizationOffset(visualType: VisualizationType): Vector3Like {
    switch (visualType) {
      case VisualizationType.PROGRESS_BAR:
        return { x: -3, y: 0, z: 0 };
      case VisualizationType.STREAK_COUNTER:
        return { x: 0, y: 0, z: 0 };
      case VisualizationType.TOPIC_MASTERY:
        return { x: 3, y: 0, z: 0 };
      case VisualizationType.ACHIEVEMENT_BOARD:
        return { x: 0, y: 2, z: 0 };
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }

  /**
   * Get element data
   */
  private _getElementData(visualType: VisualizationType, progressData: ProgressData): any {
    switch (visualType) {
      case VisualizationType.PROGRESS_BAR:
        return {
          progress: progressData.overallProgress,
          label: `Grade ${progressData.currentGrade} Progress`,
          color: progressData.overallProgress > 0.8 ? 'green' : 'blue'
        };
      
      case VisualizationType.STREAK_COUNTER:
        return {
          current: progressData.currentStreak,
          best: progressData.bestStreak,
          label: 'Streak',
          isOnStreak: progressData.currentStreak > 0
        };
      
      case VisualizationType.TOPIC_MASTERY:
        return {
          topics: Array.from(progressData.topicProgress.entries()),
          label: 'Topic Mastery'
        };
      
      case VisualizationType.ACHIEVEMENT_BOARD:
        return {
          points: progressData.achievementPoints,
          improvements: progressData.recentImprovements,
          milestones: progressData.nextMilestones,
          label: 'Achievements'
        };
      
      default:
        return {};
    }
  }

  /**
   * Check if visual type needs physical entity
   */
  private _needsPhysicalEntity(visualType: VisualizationType): boolean {
    return [
      VisualizationType.PROGRESS_BAR,
      VisualizationType.STREAK_COUNTER,
      VisualizationType.TOPIC_MASTERY
    ].includes(visualType);
  }

  /**
   * Create element entity
   */
  private _createElementEntity(element: VisualElement): Entity | undefined {
    if (!this._world) return undefined;

    try {
      const entity = new Entity({
        blockTextureUri: this._getElementTexture(element.type, element.data),
        blockHalfExtents: { x: 0.5, y: 0.5, z: 0.1 },
        rigidBodyOptions: {
          type: RigidBodyType.STATIC,
          colliders: [{
            shape: ColliderShape.BLOCK,
            halfExtents: { x: 0.5, y: 0.5, z: 0.1 },
            isSensor: true
          }]
        }
      });

      entity.spawn(this._world, element.position);
      return entity;
    } catch (error) {
      console.error('[ProgressVisualizationSystem] Error creating element entity:', error);
      return undefined;
    }
  }

  /**
   * Get element texture
   */
  private _getElementTexture(visualType: VisualizationType, data: any): string {
    switch (visualType) {
      case VisualizationType.PROGRESS_BAR:
        return data.progress > 0.8 ? 'blocks/emerald.png' : 'blocks/diamond.png';
      
      case VisualizationType.STREAK_COUNTER:
        return data.isOnStreak ? 'blocks/gold.png' : 'blocks/iron.png';
      
      case VisualizationType.TOPIC_MASTERY:
        return 'blocks/lapis.png';
      
      default:
        return 'blocks/stone.png';
    }
  }

  /**
   * Update element visual
   */
  private _updateElementVisual(element: VisualElement): void {
    if (!element.entity) return;

    try {
      // Update texture based on current data
      const newTexture = this._getElementTexture(element.type, element.data);
      
      // Since block textures cannot be changed after creation, recreate the entity
      // Store current position and other properties
      const currentPosition = element.entity.position;
      const currentRotation = element.entity.rotation;
      
      // Despawn the old entity
      if (element.entity.isSpawned) {
        element.entity.despawn();
      }
      
      // Create new entity with updated texture
      const newEntity = this._createElementEntity(element);
      if (newEntity && this._world) {
        newEntity.spawn(this._world, currentPosition, currentRotation);
        element.entity = newEntity;
      }

      // Add animation if needed
      if (this._shouldAnimate(element)) {
        this._addAnimation(element);
      }
    } catch (error) {
      console.error('[ProgressVisualizationSystem] Error updating element visual:', error);
    }
  }

  /**
   * Check if element should be animated
   */
  private _shouldAnimate(element: VisualElement): boolean {
    switch (element.type) {
      case VisualizationType.STREAK_COUNTER:
        return element.data.isOnStreak && element.data.current > 5;
      
      case VisualizationType.PROGRESS_BAR:
        return element.data.progress > 0.9;
      
      default:
        return false;
    }
  }

  /**
   * Add animation to element
   */
  private _addAnimation(element: VisualElement): void {
    const playerId = element.id.split('_')[0];
    const animations = this._animationStates.get(playerId) || [];
    
    // Check if animation already exists
    const existingAnimation = animations.find(a => a.elementId === element.id);
    if (existingAnimation) return;

    const animation: AnimationState = {
      elementId: element.id,
      animationType: element.type === VisualizationType.STREAK_COUNTER ? 'glow' : 'pulse',
      startTime: new Date(),
      duration: 2000,
      isLooping: true,
      currentFrame: 0
    };

    animations.push(animation);
    this._animationStates.set(playerId, animations);
  }

  /**
   * Update animations
   */
  private _updateAnimations(playerId: string): void {
    const animations = this._animationStates.get(playerId) || [];
    const now = new Date();

    animations.forEach(animation => {
      const elapsed = now.getTime() - animation.startTime.getTime();
      
      if (elapsed < animation.duration || animation.isLooping) {
        this._updateAnimation(animation, elapsed);
      } else {
        // Remove completed non-looping animations
        const index = animations.indexOf(animation);
        if (index > -1) {
          animations.splice(index, 1);
        }
      }
    });
  }

  /**
   * Update individual animation
   */
  private _updateAnimation(animation: AnimationState, elapsed: number): void {
    const element = this._findElementById(animation.elementId);
    if (!element?.entity) return;

    const progress = (elapsed % animation.duration) / animation.duration;
    
    try {
      switch (animation.animationType) {
        case 'pulse':
          const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.1;
          // Scale animation would be implemented here
          break;
        
        case 'glow':
          const rotation = progress * Math.PI * 2;
          element.entity.setAngularVelocity({ x: 0, y: rotation, z: 0 });
          break;
        
        case 'rotate':
          element.entity.setAngularVelocity({ x: 0, y: 1, z: 0 });
          break;
      }
    } catch (error) {
      console.error('[ProgressVisualizationSystem] Error updating animation:', error);
    }
  }

  /**
   * Find element by ID
   */
  private _findElementById(elementId: string): VisualElement | null {
    for (const elements of this._visualElements.values()) {
      const element = elements.find(e => e.id === elementId);
      if (element) return element;
    }
    return null;
  }

  /**
   * Display progress summary to player
   */
  public displayProgressSummary(playerEntity: PlayerEntity): void {
    if (!playerEntity.player) return;

    const playerId = playerEntity.player.id;
    const progressData = this._gatherProgressData(playerId);
    
    if (!progressData) return;

    let summary = `📊 Progress Summary\n\n`;
    summary += `📈 Overall Progress: ${Math.round(progressData.overallProgress * 100)}%\n`;
    summary += `🎯 Current Grade: ${progressData.currentGrade}\n`;
    summary += `🔥 Current Streak: ${progressData.currentStreak}\n`;
    summary += `📚 Questions Answered: ${progressData.questionsAnswered}\n`;
    summary += `🏆 Achievement Points: ${progressData.achievementPoints}\n\n`;

    if (progressData.recentImprovements.length > 0) {
      summary += `✨ Recent Improvements:\n`;
      progressData.recentImprovements.forEach(improvement => {
        summary += `• ${improvement}\n`;
      });
      summary += `\n`;
    }

    if (progressData.nextMilestones.length > 0) {
      summary += `🎯 Next Milestones:\n`;
      progressData.nextMilestones.forEach(milestone => {
        summary += `• ${milestone}\n`;
      });
    }

    console.log(`[ProgressVisualizationSystem] Progress Summary for ${playerId}:`);
    console.log(summary);
  }

  /**
   * Show achievement notification
   */
  public showAchievementNotification(playerEntity: PlayerEntity, notification: AchievementNotification): void {
    if (!playerEntity.player) return;

    const playerId = playerEntity.player.id;
    
    // Trigger visual effect
    this._createAchievementEffect(playerEntity, notification);
    
    console.log(`[ProgressVisualizationSystem] Achievement notification for ${playerId}: ${notification.achievement.name}`);
  }

  /**
   * Create achievement effect
   */
  private _createAchievementEffect(playerEntity: PlayerEntity, notification: AchievementNotification): void {
    if (!this._world) return;

    try {
      const position = playerEntity.getPosition();
      const effectPosition = {
        x: position.x,
        y: position.y + 4,
        z: position.z
      };

      const achievementEntity = new Entity({
        blockTextureUri: 'blocks/gold.png',
        blockHalfExtents: { x: 0.4, y: 0.4, z: 0.1 },
        rigidBodyOptions: {
          type: RigidBodyType.DYNAMIC,
          gravityScale: 0,
          colliders: [{
            shape: ColliderShape.BLOCK,
            halfExtents: { x: 0.4, y: 0.4, z: 0.1 },
            isSensor: true
          }]
        }
      });

      achievementEntity.spawn(this._world, effectPosition);
      achievementEntity.setAngularVelocity({ x: 0, y: 2, z: 0 });

      setTimeout(() => {
        if (achievementEntity.isSpawned) {
          achievementEntity.despawn();
        }
      }, 5000);

    } catch (error) {
      console.error('[ProgressVisualizationSystem] Error creating achievement effect:', error);
    }
  }

  /**
   * Toggle visualization for player
   */
  public toggleVisualization(playerId: string, visualType: VisualizationType): void {
    const config = this._playerConfigs.get(playerId);
    if (!config) return;

    if (config.enabledVisuals.has(visualType)) {
      config.enabledVisuals.delete(visualType);
      this._hideVisualization(playerId, visualType);
    } else {
      config.enabledVisuals.add(visualType);
      this._showVisualization(playerId, visualType);
    }

    console.log(`[ProgressVisualizationSystem] Toggled ${visualType} for player ${playerId}`);
  }

  /**
   * Hide visualization
   */
  private _hideVisualization(playerId: string, visualType: VisualizationType): void {
    const elements = this._visualElements.get(playerId) || [];
    const element = elements.find(e => e.type === visualType);
    
    if (element) {
      element.isActive = false;
      if (element.entity?.isSpawned) {
        element.entity.despawn();
      }
    }
  }

  /**
   * Show visualization
   */
  private _showVisualization(playerId: string, visualType: VisualizationType): void {
    const progressData = this._gatherProgressData(playerId);
    if (!progressData) return;

    this._updateVisualElement(playerId, visualType, progressData);
  }

  /**
   * Get visualization config
   */
  public getVisualizationConfig(playerId: string): VisualizationConfig | null {
    return this._playerConfigs.get(playerId) || null;
  }

  /**
   * Update visualization config
   */
  public updateVisualizationConfig(playerId: string, config: Partial<VisualizationConfig>): void {
    const currentConfig = this._playerConfigs.get(playerId);
    if (!currentConfig) return;

    Object.assign(currentConfig, config);
    console.log(`[ProgressVisualizationSystem] Updated config for player ${playerId}`);
  }

  /**
   * Clean up player visualization
   */
  public cleanupPlayerVisualization(playerId: string): void {
    const elements = this._visualElements.get(playerId) || [];
    
    elements.forEach(element => {
      if (element.entity?.isSpawned) {
        element.entity.despawn();
      }
    });

    this._visualElements.delete(playerId);
    this._animationStates.delete(playerId);
    this._playerConfigs.delete(playerId);
    
    console.log(`[ProgressVisualizationSystem] Cleaned up visualization for player ${playerId}`);
  }

  /**
   * Cleanup visualization system
   */
  public cleanup(): void {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }

    // Clean up all player visualizations
    this._playerConfigs.forEach((config, playerId) => {
      this.cleanupPlayerVisualization(playerId);
    });

    console.log('[ProgressVisualizationSystem] Cleaned up progress visualization system');
  }
}