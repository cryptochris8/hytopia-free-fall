import { PowerUpEntity, PowerUpOptions } from './PowerUpEntity';
import { PowerUpManager } from './PowerUpManager';
import type { PlayerEntity, Entity, Vector3 } from 'hytopia';

const MAGNET_DURATION = 10000; // 10 seconds
const MAGNET_RANGE = 5; // Range in blocks
const MAGNET_FORCE = 0.5; // Force strength

export class MagnetModePowerUp extends PowerUpEntity {
  constructor() {
    const options: PowerUpOptions = {
      name: 'Magnet Mode',
      duration: MAGNET_DURATION,
      modelUri: 'models/items/iron-nugget.gltf', // Using iron nugget as a magnet-like object
      modelScale: 0.8,
      pickupSoundUri: 'audio/sfx/power-up.wav',
      activateSoundUri: 'audio/sfx/correct.mp3',
      deactivateSoundUri: 'audio/sfx/ui/notification-1.mp3',
      description: 'Attracts nearby answer blocks towards you',
      color: { r: 200, g: 100, b: 255 } // Purple color
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

    // Send UI notification
    this.sendUIUpdate(player, {
      type: 'power-up-activated',
      powerUp: {
        name: this.name,
        duration: this.duration,
        color: this.color,
        icon: 'magnet'
      }
    });

    // Start magnet effect
    const magnetInterval = setInterval(() => {
      if (!playerData.entity.isSpawned || !this.world) {
        clearInterval(magnetInterval);
        return;
      }

      // Get player position
      const playerPos = playerData.entity.position;

      // Check for nearby answer blocks
      const answerBlocksManager = (this.world as any)._answerBlocksManager;
      if (answerBlocksManager && answerBlocksManager._blocks) {
        answerBlocksManager._blocks.forEach((block: Entity) => {
          if (!block.isSpawned) return;

          // Calculate distance
          const blockPos = block.position;
          const dx = playerPos.x - blockPos.x;
          const dy = playerPos.y - blockPos.y;
          const dz = playerPos.z - blockPos.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // If within range, apply magnetic force
          if (distance < MAGNET_RANGE && distance > 0.5) {
            // Normalize direction vector
            const forceX = (dx / distance) * MAGNET_FORCE;
            const forceY = (dy / distance) * MAGNET_FORCE;
            const forceZ = (dz / distance) * MAGNET_FORCE;

            // Move block towards player
            const currentVelocity = block.linearVelocity || { x: 0, y: 0, z: 0 };
            block.setLinearVelocity({
              x: currentVelocity.x + forceX,
              y: currentVelocity.y + forceY,
              z: currentVelocity.z + forceZ
            });

            // Add visual effect to attracted blocks
            block.setTintColor({ r: 255, g: 200, b: 255 });
          }
        });
      }
    }, 50); // Update every 50ms

    // Store interval reference
    (playerData as any).magnetInterval = magnetInterval;

    // Register with PowerUpManager
    PowerUpManager.getInstance().activatePowerUp(
      playerUsername,
      'MagnetMode',
      this.duration,
      () => {
        // Deactivation callback
        if (magnetInterval) {
          clearInterval(magnetInterval);
        }

        // Clean up interval reference
        if (playerData) {
          delete (playerData as any).magnetInterval;
        }

        if (playerData.entity.isSpawned) {
          // Play deactivation sound
          if (this.deactivateAudio && this.world) {
            this.deactivateAudio.play(this.world);
          }

          // Send UI notification
          this.sendUIUpdate(player, {
            type: 'power-up-deactivated',
            powerUp: 'MagnetMode'
          });
        }

        // Reset block colors
        const answerBlocksManager = (this.world as any)?._answerBlocksManager;
        if (answerBlocksManager && answerBlocksManager._blocks) {
          answerBlocksManager._blocks.forEach((block: Entity) => {
            if (block.isSpawned) {
              block.setTintColor({ r: 255, g: 255, b: 255 });
            }
          });
        }
      }
    );
  }
}