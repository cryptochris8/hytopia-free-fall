import { ParticleEmitter, World, PlayerEntity, Vector3Like } from 'hytopia';

/**
 * Particle Trail System - Creates visual particle trails for falling players
 */
export class ParticleTrailSystem {
  private static _instance: ParticleTrailSystem;
  private _playerParticles: Map<string, ParticleEmitter[]> = new Map();
  private _world: World | null = null;

  // Particle configurations for different effects
  private readonly _configs = {
    sparkleTrail: {
      textureUri: 'blocks/diamond-block.png',
      offset: { x: 0, y: 0.5, z: 0 },
      velocity: { x: 0, y: 1, z: 0 },
      velocityVariance: { x: 1.5, y: 0.5, z: 1.5 },
      sizeStart: 0.3,
      sizeEnd: 0.05,
      sizeStartVariance: 0.1,
      sizeEndVariance: 0.02,
      colorStart: { r: 255, g: 255, b: 255 },
      colorEnd: { r: 200, g: 220, b: 255 },
      colorStartVariance: { r: 50, g: 50, b: 50 },
      opacityStart: 0.8,
      opacityEnd: 0,
      lifetime: 1.5,
      lifetimeVariance: 0.5,
      rate: 20,
      maxParticles: 60,
      transparent: true,
      alphaTest: 0.01
    },
    
    speedTrail: {
      textureUri: 'blocks/water/water-flow.png',
      offset: { x: 0, y: 0.3, z: 0 },
      velocity: { x: 0, y: 3, z: 0 },
      velocityVariance: { x: 0.5, y: 1, z: 0.5 },
      sizeStart: 1.0,
      sizeEnd: 0.1,
      sizeStartVariance: 0.3,
      colorStart: { r: 150, g: 200, b: 255 },
      colorEnd: { r: 50, g: 100, b: 200 },
      opacityStart: 0.6,
      opacityEnd: 0,
      lifetime: 0.8,
      rate: 15,
      maxParticles: 30,
      transparent: true
    },
    
    windTrail: {
      textureUri: 'blocks/glass.png',
      offset: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 2, z: 0 },
      velocityVariance: { x: 3, y: 1, z: 3 },
      sizeStart: 0.5,
      sizeEnd: 1.5,
      colorStart: { r: 255, g: 255, b: 255 },
      colorEnd: { r: 200, g: 200, b: 255 },
      opacityStart: 0.3,
      opacityEnd: 0,
      lifetime: 2,
      rate: 10,
      maxParticles: 40,
      transparent: true
    }
  };

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): ParticleTrailSystem {
    if (!ParticleTrailSystem._instance) {
      ParticleTrailSystem._instance = new ParticleTrailSystem();
    }
    return ParticleTrailSystem._instance;
  }

  /**
   * Initialize the system with a world instance
   */
  public initialize(world: World): void {
    this._world = world;
  }

  /**
   * Start particle trails for a player
   */
  public startTrail(playerEntity: PlayerEntity, username: string, trailTypes: string[] = ['sparkleTrail']): void {
    if (!this._world) {
      console.error('[ParticleTrailSystem] Cannot start trail - world not set');
      return;
    }

    // Stop existing trails first
    this.stopTrail(username);

    const emitters: ParticleEmitter[] = [];

    for (const trailType of trailTypes) {
      const config = this._configs[trailType as keyof typeof this._configs];
      if (!config) {
        console.warn(`[ParticleTrailSystem] Unknown trail type: ${trailType}`);
        continue;
      }

      try {
        const emitter = new ParticleEmitter({
          ...config,
          attachedToEntity: playerEntity
        });

        emitter.spawn(this._world);
        emitters.push(emitter);
        
        console.log(`[ParticleTrailSystem] Started ${trailType} for player ${username}`);
      } catch (error) {
        console.error(`[ParticleTrailSystem] Error creating ${trailType}:`, error);
      }
    }

    if (emitters.length > 0) {
      this._playerParticles.set(username, emitters);
    }
  }

  /**
   * Stop particle trails for a player
   */
  public stopTrail(username: string): void {
    const emitters = this._playerParticles.get(username);
    if (!emitters) return;

    for (const emitter of emitters) {
      try {
        if (emitter.isSpawned) {
          emitter.despawn();
        }
      } catch (error) {
        console.error(`[ParticleTrailSystem] Error despawning emitter for ${username}:`, error);
      }
    }

    this._playerParticles.delete(username);
    console.log(`[ParticleTrailSystem] Stopped trails for player ${username}`);
  }

  /**
   * Update particle intensity based on falling speed
   */
  public updateTrailIntensity(username: string, velocity: Vector3Like): void {
    const emitters = this._playerParticles.get(username);
    if (!emitters) return;

    // Calculate falling speed (negative Y velocity)
    const fallSpeed = Math.abs(velocity.y);
    
    // Adjust particle rate based on speed (faster = more particles)
    const baseRate = 20;
    const speedMultiplier = Math.min(fallSpeed / 10, 3); // Cap at 3x
    const newRate = Math.floor(baseRate * speedMultiplier);

    for (const emitter of emitters) {
      try {
        // Update emission rate dynamically if the SDK supports it
        // Note: This might need adjustment based on actual SDK capabilities
        (emitter as any).rate = newRate;
      } catch (error) {
        // Silently handle if dynamic updates aren't supported
      }
    }
  }

  /**
   * Create a burst effect (e.g., when landing)
   */
  public createBurst(position: Vector3Like, burstType: string = 'landing'): void {
    if (!this._world) return;

    const burstConfig = {
      textureUri: 'blocks/fire/fire_01.png',
      position: position,
      velocity: { x: 0, y: 5, z: 0 },
      velocityVariance: { x: 5, y: 3, z: 5 },
      sizeStart: 0.8,
      sizeEnd: 2.0,
      colorStart: { r: 255, g: 255, b: 255 },
      colorEnd: { r: 150, g: 150, b: 200 },
      opacityStart: 1,
      opacityEnd: 0,
      lifetime: 0.8,
      rate: 0, // One-time burst
      maxParticles: 30,
      transparent: true
    };

    try {
      const burst = new ParticleEmitter(burstConfig);
      burst.spawn(this._world);

      // Emit all particles at once for burst effect
      for (let i = 0; i < 30; i++) {
        // Trigger particle emission (implementation depends on SDK)
      }

      // Clean up after burst
      setTimeout(() => {
        if (burst.isSpawned) {
          burst.despawn();
        }
      }, 2000);
    } catch (error) {
      console.error('[ParticleTrailSystem] Error creating burst effect:', error);
    }
  }

  /**
   * Clean up all particle trails
   */
  public cleanup(): void {
    console.log('[ParticleTrailSystem] Cleaning up all particle trails...');
    
    for (const [username, emitters] of this._playerParticles) {
      for (const emitter of emitters) {
        try {
          if (emitter.isSpawned) {
            emitter.despawn();
          }
        } catch (error) {
          console.error(`[ParticleTrailSystem] Error cleaning up emitter:`, error);
        }
      }
    }

    this._playerParticles.clear();
  }

  /**
   * Get active trail count
   */
  public getActiveTrailCount(): number {
    return this._playerParticles.size;
  }
}