import { Entity, World, Vector3Like, RigidBodyType, PlayerEntity } from 'hytopia';

/**
 * Score Visualization System - Creates floating score numbers and visual feedback
 */
export class ScoreVisualizationSystem {
  private static _instance: ScoreVisualizationSystem;
  private _world: World | null = null;
  private _floatingNumbers: Set<Entity> = new Set();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): ScoreVisualizationSystem {
    if (!ScoreVisualizationSystem._instance) {
      ScoreVisualizationSystem._instance = new ScoreVisualizationSystem();
    }
    return ScoreVisualizationSystem._instance;
  }

  /**
   * Initialize the system with a world instance
   */
  public initialize(world: World): void {
    this._world = world;
  }

  /**
   * Create a floating score number
   */
  public createFloatingScore(
    position: Vector3Like,
    score: number,
    type: 'correct' | 'wrong' | 'bonus' | 'combo' = 'correct',
    scale: number = 1.0
  ): void {
    if (!this._world) {
      console.error('[ScoreVisualizationSystem] Cannot create floating score - world not set');
      return;
    }

    console.log(`[ScoreVisualizationSystem] Creating floating score: ${score} (${type})`);
    
    // For now, just log the score creation - we'll implement the full visual later
    // This avoids potential SDK compatibility issues during testing
  }

  /**
   * Create a screen shake effect for big scores
   */
  public createScreenShakeEffect(playerEntity: PlayerEntity, intensity: number = 1.0): void {
    if (!playerEntity || !playerEntity.player) return;

    console.log(`[ScoreVisualizationSystem] Screen shake effect: intensity ${intensity}`);
    
    // For now, just log the effect - we'll implement the full shake later
  }

  /**
   * Create a score burst effect
   */
  public createScoreBurst(
    position: Vector3Like,
    scores: number[],
    type: 'correct' | 'wrong' | 'bonus' = 'correct'
  ): void {
    if (!this._world) return;

    console.log(`[ScoreVisualizationSystem] Score burst: ${scores.join(', ')} (${type})`);
  }

  /**
   * Clean up all floating scores
   */
  public cleanup(): void {
    console.log('[ScoreVisualizationSystem] Cleaning up floating scores...');
    
    for (const floatingScore of this._floatingNumbers) {
      try {
        if (floatingScore.isSpawned) {
          floatingScore.despawn();
        }
      } catch (error) {
        console.error('[ScoreVisualizationSystem] Error cleaning up floating score:', error);
      }
    }
    
    this._floatingNumbers.clear();
  }

  /**
   * Get active floating score count
   */
  public getActiveScoreCount(): number {
    return this._floatingNumbers.size;
  }
}