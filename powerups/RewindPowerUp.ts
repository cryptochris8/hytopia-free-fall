import { PowerUpEntity, PowerUpOptions } from './PowerUpEntity';
import { PowerUpManager } from './PowerUpManager';
import type { PlayerEntity } from 'hytopia';

const REWIND_USES = 1; // Number of times player can rewind

export class RewindPowerUp extends PowerUpEntity {
  constructor() {
    const options: PowerUpOptions = {
      name: 'Rewind',
      duration: -1, // No duration - used on demand
      textureUri: 'blocks/emerald-block.png', // Using emerald for special ability
      pickupSoundUri: 'audio/sfx/power-up.wav',
      activateSoundUri: 'audio/sfx/correct.mp3',
      deactivateSoundUri: 'audio/sfx/ui/notification-1.mp3',
      description: 'Undo your last wrong answer once',
      color: { r: 80, g: 255, b: 80 } // Green color
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

    // Add rewind uses to player state
    playerState.rewindUses = (playerState.rewindUses || 0) + REWIND_USES;

    // Send UI notification
    this.sendUIUpdate(player, {
      type: 'power-up-collected',
      powerUp: {
        name: this.name,
        color: this.color,
        icon: 'rewind',
        uses: playerState.rewindUses
      }
    });
  }

  // Static method to use rewind
  public static useRewind(playerUsername: string): boolean {
    const playerGameStateMap = (global as any).playerGameStateMap;
    const playerState = playerGameStateMap?.get(playerUsername);
    
    if (!playerState || !playerState.rewindUses || playerState.rewindUses <= 0) {
      return false;
    }

    // Check if we can rewind (must have made at least one mistake recently)
    if (!playerState.lastWrongAnswer || Date.now() - playerState.lastWrongAnswer.time > 30000) {
      // No recent wrong answer to rewind
      return false;
    }

    // Use one rewind
    playerState.rewindUses--;

    // Restore the state before the wrong answer
    playerState.score = playerState.lastWrongAnswer.previousScore || playerState.score;
    playerState.questionsPresented = playerState.lastWrongAnswer.previousQuestions || playerState.questionsPresented;
    
    // Reset gravity if it was reset due to wrong answer
    if (playerState.lastWrongAnswer.previousGravity) {
      const playerEntityMap = (global as any).playerEntityMap;
      const playerData = playerEntityMap?.get(playerUsername);
      if (playerData && playerData.entity) {
        playerData.entity.setGravityScale(playerState.lastWrongAnswer.previousGravity);
        playerState.currentGravityScale = playerState.lastWrongAnswer.previousGravity;
      }
    }

    // Clear the last wrong answer
    delete playerState.lastWrongAnswer;

    // Send UI update
    const playerEntityMap = (global as any).playerEntityMap;
    const playerData = playerEntityMap?.get(playerUsername);
    if (playerData && playerData.entity && playerData.entity.player) {
      playerData.entity.player.ui.sendData({
        type: 'rewind-used',
        remainingUses: playerState.rewindUses,
        newScore: playerState.score,
        questionsPresented: playerState.questionsPresented
      });
    }

    return true;
  }

  // Static method to record wrong answer for potential rewind
  public static recordWrongAnswer(playerUsername: string): void {
    const playerGameStateMap = (global as any).playerGameStateMap;
    const playerState = playerGameStateMap?.get(playerUsername);
    
    if (!playerState) return;

    // Store the state before the wrong answer
    playerState.lastWrongAnswer = {
      time: Date.now(),
      previousScore: playerState.score,
      previousQuestions: playerState.questionsPresented - 1, // -1 because it was just incremented
      previousGravity: playerState.currentGravityScale
    };
  }
}