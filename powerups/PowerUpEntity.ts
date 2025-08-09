import { 
  Entity, 
  RigidBodyType, 
  ColliderShape, 
  BlockType, 
  Vector3Like, 
  World,
  QuaternionLike,
  Audio
} from 'hytopia';
import type { PlayerEntity } from 'hytopia';

export interface PowerUpOptions {
  name: string;
  duration: number; // Duration in milliseconds
  textureUri?: string; // For block-based power-ups
  modelUri?: string; // For model-based power-ups (icons/3D models)
  modelScale?: number; // Scale for model-based power-ups
  pickupSoundUri?: string;
  activateSoundUri?: string;
  deactivateSoundUri?: string;
  description: string;
  color: { r: number; g: number; b: number };
}

export abstract class PowerUpEntity extends Entity {
  protected name: string;
  protected duration: number;
  protected description: string;
  protected color: { r: number; g: number; b: number };
  protected pickupAudio?: Audio;
  protected activateAudio?: Audio;
  protected deactivateAudio?: Audio;
  private rotationSpeed: number = 2;
  private floatAmplitude: number = 0.2;
  private floatSpeed: number = 2;
  private initialY: number = 0;
  private timeElapsed: number = 0;

  constructor(options: PowerUpOptions) {
    // Create entity configuration based on whether we're using a model or block texture
    const entityConfig: any = {
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
        colliders: [{
          shape: ColliderShape.BLOCK,
          halfExtents: { x: 0.4, y: 0.4, z: 0.4 },
          isSensor: true,
          onCollision: (otherEntity: Entity | BlockType, started: boolean) => {
            if (started && otherEntity instanceof Entity && 'player' in otherEntity) {
              this.onPickup(otherEntity as PlayerEntity);
            }
          }
        }]
      }
    };

    // Use either model or block texture
    if (options.modelUri) {
      entityConfig.modelUri = options.modelUri;
      entityConfig.modelScale = options.modelScale || 1.0;
    } else if (options.textureUri) {
      entityConfig.blockTextureUri = options.textureUri;
      entityConfig.blockHalfExtents = { x: 0.4, y: 0.4, z: 0.4 };
    } else {
      throw new Error('PowerUpOptions must specify either textureUri or modelUri');
    }

    super(entityConfig);

    this.name = options.name;
    this.duration = options.duration;
    this.description = options.description;
    this.color = options.color;

    // Setup audio
    if (options.pickupSoundUri) {
      this.pickupAudio = new Audio({
        uri: options.pickupSoundUri,
        volume: 0.8,
        referenceDistance: 10,
        cutoffDistance: 20
      });
    }

    if (options.activateSoundUri) {
      this.activateAudio = new Audio({
        uri: options.activateSoundUri,
        volume: 0.8,
        referenceDistance: 10,
        cutoffDistance: 20
      });
    }

    if (options.deactivateSoundUri) {
      this.deactivateAudio = new Audio({
        uri: options.deactivateSoundUri,
        volume: 0.6,
        referenceDistance: 10,
        cutoffDistance: 20
      });
    }
  }

  public spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);
    this.initialY = position.y;
    this.startAnimation();
    
    // Add glowing effect
    this.setTintColor(this.color);
  }

  private startAnimation(): void {
    const animationInterval = setInterval(() => {
      if (!this.isSpawned) {
        clearInterval(animationInterval);
        return;
      }

      this.timeElapsed += 0.016; // ~60fps

      // Rotation animation
      const currentRotation = this.rotation;
      this.setRotation({
        x: currentRotation.x,
        y: Math.sin(this.timeElapsed * this.rotationSpeed),
        z: currentRotation.z,
        w: Math.cos(this.timeElapsed * this.rotationSpeed)
      });

      // Floating animation
      const newY = this.initialY + Math.sin(this.timeElapsed * this.floatSpeed) * this.floatAmplitude;
      this.setPosition({
        x: this.position.x,
        y: newY,
        z: this.position.z
      });
    }, 16);
  }

  protected onPickup(player: PlayerEntity): void {
    if (!this.world) return;

    // Play pickup sound
    if (this.pickupAudio) {
      this.pickupAudio.play(this.world);
    }

    // Apply power-up effect to player
    this.applyEffect(player);

    // Despawn the power-up
    this.despawn();
  }

  // Abstract method that each power-up must implement
  protected abstract applyEffect(player: PlayerEntity): void;

  // Helper method to send UI updates
  protected sendUIUpdate(player: PlayerEntity, data: any): void {
    if ('player' in player && player.player) {
      player.player.ui.sendData(data);
    }
  }
}