import { PowerUpEntity, PowerUpOptions } from './PowerUpEntity';
import { PowerUpManager } from './PowerUpManager';
import type { PlayerEntity } from 'hytopia';

const SHIELD_DURATION = 5000; // 5 seconds
const SHIELD_CHARGES = 1; // Number of wrong answers it can absorb

export class ShieldBubblePowerUp extends PowerUpEntity {
  constructor() {
    const options: PowerUpOptions = {
      name: 'Shield Bubble',
      duration: SHIELD_DURATION,
      textureUri: 'blocks/diamond-block.png', // Using diamond for protection
      pickupSoundUri: 'audio/sfx/power-up.wav',
      activateSoundUri: 'audio/sfx/correct.mp3',
      deactivateSoundUri: 'audio/sfx/damage/glass-break-01.mp3',
      description: 'Protects you from one wrong answer',
      color: { r: 100, g: 255, b: 255 } // Cyan color
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

    // Play activation sound
    if (this.activateAudio) {
      this.activateAudio.play(this.world);
    }

    // Create visual shield effect
    this.createShieldVisual(playerData.entity);

    // Send UI notification
    this.sendUIUpdate(player, {
      type: 'power-up-activated',
      powerUp: {
        name: this.name,
        duration: this.duration,
        color: this.color,
        icon: 'shield',
        charges: SHIELD_CHARGES
      }
    });

    // Store shield state
    let shieldCharges = SHIELD_CHARGES;
    const shieldData = {
      charges: shieldCharges,
      active: true
    };

    // Add shield to player's temporary data
    (playerData as any).shieldBubble = shieldData;

    // Register with PowerUpManager
    PowerUpManager.getInstance().activatePowerUp(
      playerUsername,
      'ShieldBubble',
      this.duration,
      () => {
        // Deactivation callback
        if (playerData.entity.isSpawned) {
          // Remove shield
          delete (playerData as any).shieldBubble;
          
          // Remove visual effect
          playerData.entity.setTintColor({ r: 255, g: 255, b: 255 });

          // Play deactivation sound if shield wasn't consumed
          if (shieldData.charges > 0 && this.deactivateAudio && this.world) {
            this.deactivateAudio.play(this.world);
          }

          // Send UI notification
          this.sendUIUpdate(player, {
            type: 'power-up-deactivated',
            powerUp: 'ShieldBubble'
          });
        }
      }
    );
  }

  private createShieldVisual(entity: any): void {
    // Add a cyan tint to the player
    entity.setTintColor({ r: 150, g: 255, b: 255 });
    
    // We could also spawn a transparent sphere entity around the player
    // but for now, just the tint effect works well
  }

  // Static method to check and consume shield
  public static consumeShield(playerUsername: string): boolean {
    const playerEntityMap = (global as any).playerEntityMap;
    const playerData = playerEntityMap?.get(playerUsername);
    
    if (!playerData || !(playerData as any).shieldBubble) {
      return false;
    }

    const shield = (playerData as any).shieldBubble;
    if (shield.active && shield.charges > 0) {
      shield.charges--;
      
      // Update UI
      const player = playerData.entity.player;
      if (player) {
        player.ui.sendData({
          type: 'power-up-charge-used',
          powerUp: 'ShieldBubble',
          chargesRemaining: shield.charges
        });
      }

      // If no charges left, deactivate immediately
      if (shield.charges <= 0) {
        PowerUpManager.getInstance().activatePowerUp(
          playerUsername,
          'ShieldBubble',
          0, // Expire immediately
          () => {}
        );
      }

      return true;
    }

    return false;
  }
}