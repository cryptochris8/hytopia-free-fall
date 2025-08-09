import { PowerUpEntity, PowerUpOptions } from './PowerUpEntity';
import { PowerUpManager } from './PowerUpManager';
import type { PlayerEntity } from 'hytopia';

const DOUBLE_POINTS_DURATION = 15000; // 15 seconds
const POINTS_MULTIPLIER = 2;

export class DoublePointsPowerUp extends PowerUpEntity {
  constructor() {
    const options: PowerUpOptions = {
      name: 'Double Points',
      duration: DOUBLE_POINTS_DURATION,
      modelUri: 'models/items/gold-ingot.gltf', // Using gold ingot for value/points
      modelScale: 0.6,
      pickupSoundUri: 'audio/sfx/power-up.wav',
      activateSoundUri: 'audio/sfx/correct.mp3',
      deactivateSoundUri: 'audio/sfx/ui/notification-1.mp3',
      description: 'Doubles your score for correct answers',
      color: { r: 255, g: 215, b: 0 } // Gold color
    };
    
    super(options);
  }

  protected applyEffect(player: PlayerEntity): void {
    const playerUsername = (player as any).player?.username;
    if (!playerUsername || !this.world) return;

    // Get player state from the map
    const playerGameStateMap = (global as any).playerGameStateMap;
    const playerState = playerGameStateMap?.get(playerUsername);
    
    if (!playerState) return;

    // Play activation sound
    if (this.activateAudio) {
      this.activateAudio.play(this.world);
    }

    // Store original score multiplier (if any) or default to 1
    const originalMultiplier = playerState.scoreMultiplier || 1;
    
    // Apply double points multiplier
    playerState.scoreMultiplier = originalMultiplier * POINTS_MULTIPLIER;

    // Send UI notification
    this.sendUIUpdate(player, {
      type: 'power-up-activated',
      powerUp: {
        name: this.name,
        duration: this.duration,
        color: this.color,
        icon: 'doublepoints',
        multiplier: POINTS_MULTIPLIER
      }
    });

    // Register with PowerUpManager
    PowerUpManager.getInstance().activatePowerUp(
      playerUsername,
      'DoublePoints',
      this.duration,
      () => {
        // Deactivation callback
        const currentState = playerGameStateMap?.get(playerUsername);
        if (currentState) {
          // Restore original multiplier
          currentState.scoreMultiplier = originalMultiplier;

          // Play deactivation sound
          if (this.deactivateAudio && this.world) {
            this.deactivateAudio.play(this.world);
          }

          // Send UI notification
          this.sendUIUpdate(player, {
            type: 'power-up-deactivated',
            powerUp: 'DoublePoints'
          });
        }
      }
    );
  }

  // Static helper method to get current score multiplier
  public static getScoreMultiplier(playerUsername: string): number {
    const playerGameStateMap = (global as any).playerGameStateMap;
    const playerState = playerGameStateMap?.get(playerUsername);
    return playerState?.scoreMultiplier || 1;
  }
}