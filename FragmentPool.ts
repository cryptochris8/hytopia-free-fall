import { Entity, Vector3, RigidBodyType, World, Vector3Like, EntityOptions } from 'hytopia';
import { FragmentTextureManager } from './FragmentTextureManager';

/**
 * Fragment Pool System - Optimizes fragment entity management by reusing entities
 * instead of constantly creating and destroying them.
 */
export class FragmentPool {
  private static _instance: FragmentPool;
  private _pool: Entity[] = [];
  private _activeFragments: Map<Entity, NodeJS.Timeout> = new Map();
  private _poolSize: number;
  private _world: World | null = null;
  
  // Fragment configuration
  private readonly _fragmentOptions: Partial<EntityOptions> = {
    blockHalfExtents: { x: 0.15, y: 0.15, z: 0.15 },
    rigidBodyOptions: {
      type: RigidBodyType.DYNAMIC,
      gravityScale: 0.8,
      colliders: [{
        shape: 3, // Box shape
        halfExtents: { x: 0.15, y: 0.15, z: 0.15 },
        isSensor: true
      }]
    }
  };

  private constructor(poolSize: number = 50) {
    this._poolSize = poolSize;
  }

  /**
   * Get the singleton instance of the FragmentPool
   */
  public static getInstance(poolSize?: number): FragmentPool {
    if (!FragmentPool._instance) {
      FragmentPool._instance = new FragmentPool(poolSize);
    }
    return FragmentPool._instance;
  }

  /**
   * Initialize the pool with a world instance
   */
  public initialize(world: World): void {
    this._world = world;
    this._preallocateFragments();
  }

  /**
   * Pre-allocate fragment entities to the pool
   */
  private _preallocateFragments(): void {
    if (!this._world) {
      console.error('[FragmentPool] Cannot preallocate - world not set');
      return;
    }

    console.log(`[FragmentPool] Pre-allocating ${this._poolSize} fragments...`);
    
    for (let i = 0; i < this._poolSize; i++) {
      const fragment = new Entity({
        ...this._fragmentOptions,
        blockTextureUri: 'blocks/stone.png' // Default texture
      });
      
      // Spawn the fragment at a far-away position initially
      fragment.spawn(this._world, { x: 0, y: -1000, z: 0 });
      fragment.setCollisionGroupsForSolidColliders({
        belongsTo: [],
        collidesWith: []
      });
      
      this._pool.push(fragment);
    }
    
    console.log(`[FragmentPool] Successfully pre-allocated ${this._pool.length} fragments`);
  }

  /**
   * Get a fragment from the pool
   */
  public getFragment(
    position: Vector3Like,
    textureUri: string,
    velocity: Vector3Like,
    angularVelocity: Vector3Like,
    durationMs: number = 1500
  ): Entity | null {
    if (!this._world) {
      console.error('[FragmentPool] Cannot get fragment - world not set');
      return null;
    }

    // Try to get from pool first
    let fragment = this._pool.pop();
    
    // If pool is empty, create a new one
    if (!fragment) {
      console.warn('[FragmentPool] Pool exhausted, creating new fragment');
      fragment = new Entity({
        ...this._fragmentOptions,
        blockTextureUri: textureUri
      });
      fragment.spawn(this._world, position);
    }

    // Configure the fragment
    try {
      // Update texture
      fragment.setBlockTextureUri(textureUri);
      
      // Reset and position the fragment
      fragment.setPosition(position);
      fragment.setLinearVelocity(velocity);
      fragment.setAngularVelocity(angularVelocity);
      
      // Re-enable collisions
      fragment.setCollisionGroupsForSolidColliders({
        belongsTo: [1], // Default collision group
        collidesWith: [1, 2] // Collide with blocks and entities
      });

      // Set up auto-return timer
      const timer = setTimeout(() => {
        this.returnFragment(fragment);
      }, durationMs);

      this._activeFragments.set(fragment, timer);
      
      return fragment;
    } catch (error) {
      console.error('[FragmentPool] Error configuring fragment:', error);
      // Return fragment to pool if configuration failed
      this._pool.push(fragment);
      return null;
    }
  }

  /**
   * Return a fragment to the pool
   */
  public returnFragment(fragment: Entity): void {
    if (!fragment || !fragment.isSpawned) {
      return;
    }

    // Clear any existing timer
    const timer = this._activeFragments.get(fragment);
    if (timer) {
      clearTimeout(timer);
      this._activeFragments.delete(fragment);
    }

    try {
      // Reset fragment state
      fragment.setLinearVelocity({ x: 0, y: 0, z: 0 });
      fragment.setAngularVelocity({ x: 0, y: 0, z: 0 });
      
      // Move to a far-away position
      fragment.setPosition({ x: 0, y: -1000, z: 0 });
      
      // Disable collisions
      fragment.setCollisionGroupsForSolidColliders({
        belongsTo: [],
        collidesWith: []
      });

      // Return to pool
      this._pool.push(fragment);
    } catch (error) {
      console.error('[FragmentPool] Error returning fragment to pool:', error);
    }
  }

  /**
   * Spawn break effect using pooled fragments with enhanced physics
   */
  public spawnBreakEffect(
    position: Vector3Like,
    textureUri: string,
    fragmentCount: number = 4,
    durationMs: number = 1500,
    baseVelocity: number = 3.0,
    angularSpeed: number = 2.0,
    effectType: 'default' | 'explosive' | 'implosion' | 'spiral' = 'default'
  ): void {
    console.log(`[FragmentPool] Spawning ${fragmentCount} fragments at ${JSON.stringify(position)} with effect: ${effectType}`);
    
    // Get varied textures for fragments
    const fragmentTextures = FragmentTextureManager.getInstance().getFragmentTextures(textureUri, fragmentCount);

    for (let i = 0; i < fragmentCount; i++) {
      let velocity: Vector3Like;
      let angularVelocity: Vector3Like;
      
      switch (effectType) {
        case 'explosive':
          // Explosive effect - fragments fly outward with high velocity
          const explosiveAngle = (i / fragmentCount) * Math.PI * 2;
          const explosiveY = Math.random() * 0.5 + 0.5; // Upward bias
          velocity = {
            x: Math.cos(explosiveAngle) * baseVelocity * 2,
            y: explosiveY * baseVelocity * 2.5,
            z: Math.sin(explosiveAngle) * baseVelocity * 2
          };
          angularVelocity = {
            x: (Math.random() - 0.5) * angularSpeed * 3,
            y: (Math.random() - 0.5) * angularSpeed * 3,
            z: (Math.random() - 0.5) * angularSpeed * 3
          };
          break;
          
        case 'implosion':
          // Implosion effect - fragments move inward then outward
          const implosionAngle = (i / fragmentCount) * Math.PI * 2;
          velocity = {
            x: -Math.cos(implosionAngle) * baseVelocity * 0.5,
            y: Math.random() * baseVelocity,
            z: -Math.sin(implosionAngle) * baseVelocity * 0.5
          };
          // Schedule velocity reversal
          setTimeout(() => {
            const fragment = this.getFragment(position, textureUri, {
              x: Math.cos(implosionAngle) * baseVelocity * 1.5,
              y: baseVelocity * 2,
              z: Math.sin(implosionAngle) * baseVelocity * 1.5
            }, angularVelocity, durationMs - 200);
          }, 200);
          continue; // Skip this iteration
          
        case 'spiral':
          // Spiral effect - fragments move in a spiral pattern
          const spiralAngle = (i / fragmentCount) * Math.PI * 2;
          const spiralTime = i / fragmentCount;
          velocity = {
            x: Math.cos(spiralAngle + spiralTime * Math.PI) * baseVelocity,
            y: baseVelocity * (1 + spiralTime),
            z: Math.sin(spiralAngle + spiralTime * Math.PI) * baseVelocity
          };
          angularVelocity = {
            x: Math.cos(spiralAngle) * angularSpeed,
            y: angularSpeed * 2,
            z: Math.sin(spiralAngle) * angularSpeed
          };
          break;
          
        default:
          // Default random direction
          const dirX = Math.random() - 0.5;
          const dirY = Math.random() - 0.5;
          const dirZ = Math.random() - 0.5;
          const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
          const normX = length === 0 ? 0 : dirX / length;
          const normY = length === 0 ? 1 : dirY / length;
          const normZ = length === 0 ? 0 : dirZ / length;
          
          velocity = {
            x: normX * baseVelocity * (0.5 + Math.random() * 0.5),
            y: normY * baseVelocity * (0.5 + Math.random() * 0.5),
            z: normZ * baseVelocity * (0.5 + Math.random() * 0.5)
          };
          
          angularVelocity = {
            x: (Math.random() - 0.5) * angularSpeed,
            y: (Math.random() - 0.5) * angularSpeed,
            z: (Math.random() - 0.5) * angularSpeed
          };
      }

      // Get fragment from pool with varied texture
      const fragmentTexture = fragmentTextures[i] || textureUri;
      const fragment = this.getFragment(
        position,
        fragmentTexture,
        velocity,
        angularVelocity,
        durationMs
      );

      if (!fragment) {
        console.warn(`[FragmentPool] Failed to get fragment ${i + 1}/${fragmentCount}`);
      }
    }
  }

  /**
   * Clean up the pool
   */
  public cleanup(): void {
    console.log('[FragmentPool] Cleaning up fragment pool...');
    
    // Clear all active fragments
    this._activeFragments.forEach((timer, fragment) => {
      clearTimeout(timer);
      if (fragment.isSpawned) {
        fragment.despawn();
      }
    });
    this._activeFragments.clear();

    // Despawn all pooled fragments
    this._pool.forEach(fragment => {
      if (fragment.isSpawned) {
        fragment.despawn();
      }
    });
    this._pool = [];
  }

  /**
   * Get pool statistics
   */
  public getStats(): { pooled: number, active: number, total: number } {
    return {
      pooled: this._pool.length,
      active: this._activeFragments.size,
      total: this._pool.length + this._activeFragments.size
    };
  }
}