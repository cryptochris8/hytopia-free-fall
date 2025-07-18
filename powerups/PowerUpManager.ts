import { World, Vector3Like } from 'hytopia';
import { PowerUpEntity } from './PowerUpEntity';
import type { PlayerEntity } from 'hytopia';

interface ActivePowerUp {
  type: string;
  endTime: number;
  deactivate: () => void;
}

export class PowerUpManager {
  private static instance: PowerUpManager;
  private world: World | null = null;
  private activePowerUps: Map<string, Map<string, ActivePowerUp>> = new Map(); // playerUsername -> powerUpType -> ActivePowerUp
  private spawnedPowerUps: PowerUpEntity[] = [];
  private powerUpCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): PowerUpManager {
    if (!PowerUpManager.instance) {
      PowerUpManager.instance = new PowerUpManager();
    }
    return PowerUpManager.instance;
  }

  public initialize(world: World): void {
    this.world = world;
    this.startPowerUpCheck();
  }

  public cleanup(): void {
    // Clear all spawned power-ups
    this.spawnedPowerUps.forEach(powerUp => {
      if (powerUp.isSpawned) {
        powerUp.despawn();
      }
    });
    this.spawnedPowerUps = [];

    // Clear all active power-ups
    this.activePowerUps.clear();

    // Stop the check interval
    if (this.powerUpCheckInterval) {
      clearInterval(this.powerUpCheckInterval);
      this.powerUpCheckInterval = null;
    }
  }

  public spawnPowerUp(PowerUpClass: typeof PowerUpEntity, position: Vector3Like): void {
    if (!this.world) return;

    const powerUp = new (PowerUpClass as any)();
    powerUp.spawn(this.world, position);
    this.spawnedPowerUps.push(powerUp);

    // Remove after 30 seconds if not collected
    setTimeout(() => {
      if (powerUp.isSpawned) {
        powerUp.despawn();
        const index = this.spawnedPowerUps.indexOf(powerUp);
        if (index > -1) {
          this.spawnedPowerUps.splice(index, 1);
        }
      }
    }, 30000);
  }

  public activatePowerUp(
    playerUsername: string, 
    powerUpType: string, 
    duration: number, 
    deactivate: () => void
  ): void {
    // Get or create player's power-up map
    if (!this.activePowerUps.has(playerUsername)) {
      this.activePowerUps.set(playerUsername, new Map());
    }
    
    const playerPowerUps = this.activePowerUps.get(playerUsername)!;
    
    // If this power-up is already active, extend its duration
    const existingPowerUp = playerPowerUps.get(powerUpType);
    if (existingPowerUp) {
      existingPowerUp.endTime = Date.now() + duration;
    } else {
      // Add new power-up
      playerPowerUps.set(powerUpType, {
        type: powerUpType,
        endTime: Date.now() + duration,
        deactivate
      });
    }
  }

  public isPlayerPowerUpActive(playerUsername: string, powerUpType: string): boolean {
    const playerPowerUps = this.activePowerUps.get(playerUsername);
    if (!playerPowerUps) return false;
    
    const powerUp = playerPowerUps.get(powerUpType);
    return powerUp ? powerUp.endTime > Date.now() : false;
  }

  public getActivePowerUps(playerUsername: string): string[] {
    const playerPowerUps = this.activePowerUps.get(playerUsername);
    if (!playerPowerUps) return [];
    
    return Array.from(playerPowerUps.keys()).filter(type => 
      this.isPlayerPowerUpActive(playerUsername, type)
    );
  }

  private startPowerUpCheck(): void {
    // Check every 100ms for expired power-ups
    this.powerUpCheckInterval = setInterval(() => {
      const now = Date.now();
      
      this.activePowerUps.forEach((playerPowerUps, playerUsername) => {
        playerPowerUps.forEach((powerUp, type) => {
          if (powerUp.endTime <= now) {
            // Deactivate the power-up
            powerUp.deactivate();
            playerPowerUps.delete(type);
          }
        });
        
        // Clean up empty player entries
        if (playerPowerUps.size === 0) {
          this.activePowerUps.delete(playerUsername);
        }
      });
    }, 100);
  }

  public cleanupPlayer(playerUsername: string): void {
    const playerPowerUps = this.activePowerUps.get(playerUsername);
    if (playerPowerUps) {
      // Deactivate all power-ups
      playerPowerUps.forEach(powerUp => {
        powerUp.deactivate();
      });
      this.activePowerUps.delete(playerUsername);
    }
  }
}