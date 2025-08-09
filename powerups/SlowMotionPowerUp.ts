import { PowerUpEntity, PowerUpOptions } from './PowerUpEntity';
import { PowerUpManager } from './PowerUpManager';
import type { PlayerEntity } from 'hytopia';

const SLOW_MOTION_DURATION = 8000; // 8 seconds
const SLOW_MOTION_SCALE = 0.3; // 30% of normal speed

export class SlowMotionPowerUp extends PowerUpEntity {
  constructor() {
    const options: PowerUpOptions = {
      name: 'Slow Motion',
      duration: SLOW_MOTION_DURATION,
      modelUri: 'models/items/snowball.gltf', // Using snowball for slow/cold effect
      modelScale: 0.7,
      pickupSoundUri: 'audio/sfx/power-up.wav',
      activateSoundUri: 'audio/sfx/correct.mp3',
      deactivateSoundUri: 'audio/sfx/ui/notification-1.mp3',
      description: 'Slows down your fall speed for precise movements',
      color: { r: 150, g: 200, b: 255 } // Light blue color
    };
    
    super(options);
  }

  protected applyEffect(player: PlayerEntity): void {
    const playerUsername = (player as any).player?.username;
    if (!playerUsername || !this.world) return;

    // Get player data from the map
    const playerEntityMap = (global as any).playerEntityMap;
    const playerData = playerEntityMap?.get(playerUsername);
    
    if (!playerData || !playerData.entity) return;

    const originalGravityScale = playerData.entity.rigidBodyOptions?.gravityScale || 0.1;
    
    // Apply slow motion effect
    playerData.entity.setGravityScale(originalGravityScale * SLOW_MOTION_SCALE);
    
    // Play activation sound
    if (this.activateAudio) {
      this.activateAudio.play(this.world);
    }

    // Send UI notification
    this.sendUIUpdate(player, {
      type: 'power-up-activated',
      powerUp: {
        name: this.name,
        duration: this.duration,
        color: this.color,
        icon: 'slowmotion'
      }
    });

    // Register with PowerUpManager
    PowerUpManager.getInstance().activatePowerUp(
      playerUsername,
      'SlowMotion',
      this.duration,
      () => {
        // Deactivation callback
        if (playerData.entity.isSpawned) {
          // Get current state to handle difficulty-based gravity
          const playerStateMap = (global as any).playerGameStateMap;
          const playerState = playerStateMap?.get(playerUsername);
          
          if (playerState) {
            // Restore gravity based on current game state
            const baseGravity = 0.1;
            const gravityMultiplier = playerState.currentGravityScale / baseGravity;
            playerData.entity.setGravityScale(baseGravity * gravityMultiplier);
          } else {
            // Fallback to original gravity
            playerData.entity.setGravityScale(originalGravityScale);
          }

          // Play deactivation sound
          if (this.deactivateAudio && this.world) {
            this.deactivateAudio.play(this.world);
          }

          // Send UI notification
          this.sendUIUpdate(player, {
            type: 'power-up-deactivated',
            powerUp: 'SlowMotion'
          });
        }
      }
    );
  }
}