import { startServer, World, Entity, PlayerEvent, PlayerEntity, Audio, RigidBodyType, ColliderShape, BaseEntityController, EntityEvent, PlayerUIEvent, PlayerCameraMode, CollisionGroup, Player } from 'hytopia';
import type { PlayerInput } from 'hytopia';
import type { PlayerCameraOrientation } from 'hytopia';
import type { Vector3Like } from 'hytopia';
import type { Vector3 } from 'hytopia';
import type { CollisionCallback } from 'hytopia';
import type { BlockType } from 'hytopia';

// Import power-up system
import { 
  PowerUpManager, 
  SlowMotionPowerUp, 
  ShieldBubblePowerUp, 
  MagnetModePowerUp, 
  DoublePointsPowerUp, 
  RewindPowerUp 
} from './powerups';

// Import Fragment Pool system
import { FragmentPool } from './FragmentPool';

// Import Particle Trail system
import { ParticleTrailSystem } from './ParticleTrailSystem';

// Import Score Visualization system
import { ScoreVisualizationSystem } from './ScoreVisualizationSystem';

// Import Phase 2 systems
import { CurriculumSystem } from './CurriculumSystem';
import { LearningAnalyticsDashboard } from './LearningAnalyticsDashboard';
import { AchievementSystem } from './AchievementSystem';
import { AdaptiveDifficultySystem } from './AdaptiveDifficultySystem';
import { ProgressVisualizationSystem } from './ProgressVisualizationSystem';

// Import Phase 3 systems
import CompetitiveRaceManager from './CompetitiveRaceManager';
import TeamChallengeManager from './TeamChallengeManager';
import GlobalLeaderboardSystem from './GlobalLeaderboardSystem';
import SocialFeaturesSystem from './SocialFeaturesSystem';

// Import Phase 4 systems
import { AdvancedMobileControls } from './AdvancedMobileControls';
import { PerformanceMonitor } from './PerformanceMonitor';
import { AccessibilityFeatures, AudioCueType } from './AccessibilityFeatures';

declare module 'hytopia' {
  interface EventPayloads {
    'correctAnswer': { player: Player };
    'wrongAnswer': { player: Player };
    'playerLanded': { player: Player };
    'doubleTapAction': { player: Player };
    'newMathProblem': { num1: number; operator: string; num2: number };
    // Add game end event if needed for server-side logic (optional here)
    // 'gameEnd': { player: Player, finalScore: number }; 
  }
}

// Add interface and new map definition (outside any class)
interface PlayerData {
  entity: PlayerEntity;
  controller: FallingPlayerController;
}
const playerEntityMap = new Map<string, PlayerData>(); // Use the new interface
// Make maps globally accessible for power-ups
(global as any).playerEntityMap = playerEntityMap;

// --- Player Game State ---
// Define an interface for player-specific game state
interface PlayerGameState {
  score: number;
  questionsPresented: number; // Renamed from questionsAsked
  gameActive: boolean;
  currentAnswer: number; // Store the correct answer for the current question
  difficulty: 'beginner' | 'moderate' | 'hard'; // Add difficulty level
  isFinalFall: boolean;
  currentGravityScale: number; // NEW: Track player's current gravity scale
}

// Store player game states in a map
const playerGameStateMap = new Map<string, PlayerGameState>();
// Make maps globally accessible for power-ups
(global as any).playerGameStateMap = playerGameStateMap;

// let planeSpawned = false; // Flag removed - plane is now UI-based

const MAX_QUESTIONS = 10; // Define the total number of questions per game

// --- Constants ---

// Game Settings
const GAME_RESET_DELAY_MS = 500; // Delay after answer before reset/next question (increased to ensure blocks clear)
const BACKGROUND_MUSIC_DELAY_MS = 15000; // Delay before background music starts

// Player Settings
const PLAYER_MOVE_SPEED = 5; // blocks per second
const PLAYER_MODEL_URI = 'models/players/player.gltf';
const PLAYER_MODEL_SCALE = 0.5;
const PLAYER_INITIAL_ANIMATION = 'idle';
const PLAYER_WALK_ANIMATION = 'walk';
const PLAYER_FALL_ANIMATION = 'jump_loop'; // Add new free fall animation constant
const PLAYER_LAND_ANIMATION = 'jump_post_light'; // Add landing animation constant
const PLAYER_GRAVITY_SCALE = 0.1;
const GRAVITY_INCREASE_PER_CORRECT = 0.05; // NEW: Amount to increase gravity per correct answer
const MAX_GRAVITY_MULTIPLIER = 3; // NEW: Maximum multiplier for gravity scale
const PLAYER_LINEAR_DAMPING = 0.5;
const PLAYER_COLLIDER_HALF_HEIGHT = 0.5;
const PLAYER_COLLIDER_RADIUS = 0.3;
const PLAYER_SPAWN_POSITION: Vector3Like = { x: 0, y: 25, z: 0 };
const PLAYER_RESET_POSITION: Vector3Like = { x: 0, y: 0, z: 0 }; // Reset height to 0
const PLAYER_CAMERA_OFFSET: Vector3Like = { x: 0, y: 1.5, z: 0 };
const PLAYER_CAMERA_FORWARD_OFFSET = 1.0;
const PLAYER_FACING_DOWN_ROTATION = { x: -0.7071068, y: 0, z: 0, w: 0.7071068 }; // Quaternion for -90 degrees on X-axis

// Answer Block Settings
const ANSWER_BLOCK_TEXTURE_PATH = 'blocks/Free-fall/'; // Base path, number appended
const ANSWER_BLOCK_HALF_EXTENTS: Vector3Like = { x: 0.5, y: 0.5, z: 0.5 };
const ANSWER_BLOCK_SPACING = 3;
const ANSWER_BLOCK_Y_POSITION = -80;
const ANSWER_BLOCK_BREAK_FRAGMENTS = 4;
const ANSWER_BLOCK_BREAK_DURATION_MS = 1500;
const ANSWER_BLOCK_BREAK_VELOCITY = 3.0;
const ANSWER_BLOCK_BREAK_ANGULAR_SPEED = 2.0;
const ANSWER_BLOCK_BREAK_FRAGMENT_HALF_EXTENTS: Vector3Like = { x: 0.15, y: 0.15, z: 0.15 };
const ANSWER_BLOCK_BREAK_FRAGMENT_GRAVITY = 0.8;
const FALL_THRESHOLD_Y = ANSWER_BLOCK_Y_POSITION - 5; // Y-level to trigger fall detection (NEW)

// Math Problem Generation
const MATH_PROBLEM_MAX_VALUE = 15; // Max number or answer for simple ops
const MATH_PROBLEM_MAX_VALUE_ADD = 15;
const MATH_PROBLEM_MAX_VALUE_SUB = 15;
const MATH_PROBLEM_MAX_VALUE_MUL = 15;
const MATH_PROBLEM_MAX_VALUE_DIV_ANSWER = 15; // Max value for the *answer* of division
const MATH_PROBLEM_MAX_VALUE_DIV_DIVISOR = 5; // Max value for the divisor
const MATH_PROBLEM_MAX_VALUE_DIV_NUM1 = 30; // Max value for the dividend (num1)
const MATH_PROBLEM_OPERATIONS = ['+', '-', '*', '/'];
const WRONG_ANSWER_COUNT = 3;
const WRONG_ANSWER_RANGE = 10; // Range (+/-) around correct answer to generate wrong ones
const WRONG_ANSWER_MAX_ATTEMPTS = 100; // Safety break for generation
const WRONG_ANSWER_MIN_VALUE = 0;
const WRONG_ANSWER_MAX_VALUE = 15; // Ensure wrong answers stay within 0-15

// Audio Paths
const AUDIO_MUSIC_BACKGROUND = 'audio/music/Free-fall.mp3';
const AUDIO_SFX_CORRECT = 'audio/sfx/correct.mp3';
const AUDIO_SFX_WRONG = 'audio/sfx/wrong.mp3';
const AUDIO_SFX_LANDING = 'audio/sfx/landing.mp3'; // ADDED
const AUDIO_SFX_VOLUME = 1.0;
const AUDIO_SFX_REFERENCE_DISTANCE = 15;
const AUDIO_MUSIC_VOLUME = 0.7;

// UI Paths
const UI_INDEX_PATH = 'ui/index.html';

// Temporary Effect Settings
const EFFECT_BLOCK_CORRECT_TEXTURE = 'blocks/emerald-block.png';
const EFFECT_BLOCK_WRONG_TEXTURE = 'blocks/fire/fire_01.png';
const EFFECT_BLOCK_COUNT = 2;
const EFFECT_BLOCK_DURATION_MS = 500;
const EFFECT_BLOCK_HALF_EXTENTS: Vector3Like = { x: 0.15, y: 0.15, z: 0.15 };
const EFFECT_BLOCK_SPREAD_XZ = 1.5; // Horizontal spread range
const EFFECT_BLOCK_SPREAD_Y = 0.5; // Vertical spawn offset range
const EFFECT_BLOCK_OFFSET_Y = 0.2; // Base vertical spawn offset

// Number Tunnel Settings
const TUNNEL_RADIUS = 10;
const TUNNEL_HEIGHT = 300;
const TUNNEL_SEGMENTS = 150;
const TUNNEL_BLOCKS_PER_RING = 16;
const TUNNEL_BLOCK_HALF_EXTENTS: Vector3Like = { x: 0.5, y: 0.5, z: 0.5 };
const TUNNEL_DECOR_LIGHTS_PER_RING = 4;
const TUNNEL_DECOR_SEGMENT_STEP = 5; // Add decorations every 5 segments
const TUNNEL_DECOR_RADIUS_OFFSET = 1.5; // How far inside the wall
const TUNNEL_DECOR_TEXTURE_DIAMOND = 'blocks/diamond-block.png';
const TUNNEL_DECOR_TEXTURE_EMERALD = 'blocks/emerald-block.png';
const TUNNEL_DECOR_TEXTURE_HYTOPIA_LOGO = 'ui/logos/hytopia-icon-big.png'; // Path relative to assets folder
const TUNNEL_DECOR_HALF_EXTENTS: Vector3Like = { x: 0.25, y: 0.25, z: 0.25 };
const TUNNEL_DECOR_ANGULAR_VELOCITY: Vector3Like = { x: 1, y: 1, z: 0 };

// Cloud System Settings
const CLOUD_COUNT = 15;
const CLOUD_CENTER: Vector3Like = { x: 0, y: 0, z: 0 };
const CLOUD_RADIUS_MIN = 50;
const CLOUD_RADIUS_MAX = 100;
const CLOUD_HEIGHT_MIN = -100;
const CLOUD_HEIGHT_MAX = 220;
const CLOUD_BLOCKS_PER_FORMATION = 8;
const CLOUD_BLOCK_TEXTURE = 'blocks/snow.png';
const CLOUD_BLOCK_HALF_EXTENTS: Vector3Like = { x: 0.5, y: 0.5, z: 0.5 };
const CLOUD_BLOCK_SPREAD_XZ = 5;
const CLOUD_BLOCK_SPREAD_Y = 2;

// --- Landing Platform Settings ---
const LANDING_PLATFORM_Y = ANSWER_BLOCK_Y_POSITION - 80; // Much lower position for a longer fall experience
const LANDING_PLATFORM_SIZE = 14; // Adjusted size for a balance between detail and simplicity
// Textures for different terrain types
const LANDING_PLATFORM_TEXTURES = {
    GRASS: 'blocks/grass-block.png',
    WATER: 'blocks/water-still.png',
    SAND: 'blocks/sand.png',
    STONE: 'blocks/stone.png',
    DIRT: 'blocks/dirt.png',
    WOOD: 'blocks/oak-planks.png',
    BRICK: 'blocks/bricks.png',
    LAVA: 'blocks/lava.png',
    SNOW: 'blocks/snow.png',
    LEAVES: 'blocks/oak-leaves.png'        // NEW: For better looking trees
};
const LANDING_PLATFORM_BLOCK_HALF_EXTENTS: Vector3Like = { x: 0.5, y: 0.5, z: 0.5 };

// --- Power-up Settings ---
const POWERUP_SPAWN_CHANCE = 0.3; // 30% chance to spawn a power-up
const POWERUP_SPAWN_Y_OFFSET = 10; // Spawn power-ups above answer blocks
const POWERUP_TYPES = [
  SlowMotionPowerUp,
  ShieldBubblePowerUp,
  MagnetModePowerUp,
  DoublePointsPowerUp,
  RewindPowerUp
];

// --- Classes ---

class FallingPlayerController extends BaseEntityController {
  private moveSpeed = PLAYER_MOVE_SPEED; // blocks per second
  private isMoving = false; // Track movement state
  private hasFallen = false; // Flag to prevent multiple fall triggers (NEW)
  private _world: World; // Store world reference (NEW)
  private isFalling = false; // Track if player is actively falling
  private hasLanded = false; // NEW flag to track landing state

  // Update constructor to accept World (NEW)
  constructor(world: World) {
    super(); // Call base constructor
    this._world = world;
  }

  public tickWithPlayerInput(
    entity: PlayerEntity,
    input: PlayerInput,
    cameraOrientation: PlayerCameraOrientation,
    deltaTimeMs: number
  ): void {
    // Track performance for Phase 4 monitoring
    PerformanceMonitor.instance.trackPerformance(deltaTimeMs);
    
    // Lock camera orientation to look straight down (90 degrees)
    cameraOrientation.pitch = -Math.PI / 2; // 90 degrees down
    cameraOrientation.yaw = 0;

    // Set player rotation using constant ONLY if not landed
    if (!this.hasLanded) {
      try {
        entity.setRotation(PLAYER_FACING_DOWN_ROTATION);
      } catch (error) {
        console.error(`[FallingPlayerController] Error setting rotation for entity ${entity.id}:`, error);
      }
    }

    // Get current position
    const currentPos = entity.position;

    // --- Fall Detection Logic (NEW) ---
    // Check if player has fallen below threshold AND hasn't triggered the fall yet
    if (currentPos.y < FALL_THRESHOLD_Y && !this.hasFallen) {
      const player = entity.player;
      const playerState = playerGameStateMap.get(player.username);

      // Check if game is active for this player AND not in final fall
      if (playerState && playerState.gameActive && !playerState.isFinalFall) {
        console.log(`[FallingPlayerController] Player ${player.username} fell below threshold Y=${FALL_THRESHOLD_Y}. Emitting wrongAnswer.`);
        // Emit the wrong answer event
        this._world.emit('wrongAnswer', { player: player });
        // Set the flag to prevent re-triggering
        this.hasFallen = true;
      }
      // Note: No 'else' needed here. If game isn't active, we just don't trigger.
    }
    // --- End Fall Detection Logic ---

    // Check if we should switch to falling animation based on vertical velocity
    try {
      const velocity = entity.linearVelocity || { x: 0, y: 0, z: 0 };
      const isFastFalling = velocity.y < -5; // Consider fast downward movement as falling
      
      // If player state indicates final fall or has significant downward velocity, show falling animation
      const playerState = entity.player ? playerGameStateMap.get(entity.player.username) : null;
      const shouldShowFallAnimation = playerState?.isFinalFall || isFastFalling;
      
      // Only change animation state when there's a transition
      if (shouldShowFallAnimation && !this.isFalling) {
        // Switch to falling animation
        console.log(`[FallingPlayerController] Transitioning to fall animation for ${entity.player?.username || entity.id}`);
        entity.stopModelAnimations([PLAYER_INITIAL_ANIMATION, PLAYER_WALK_ANIMATION]);
        entity.startModelLoopedAnimations([PLAYER_FALL_ANIMATION]);
        this.isFalling = true;
        this.isMoving = false; // Reset moving state
        
        // Start particle trails when falling
        if (entity.player?.username) {
          ParticleTrailSystem.getInstance().startTrail(entity, entity.player.username, ['sparkleTrail', 'windTrail']);
        }
      } else if (!shouldShowFallAnimation && this.isFalling) {
        // Switch back to idle/walk
        console.log(`[FallingPlayerController] Transitioning from fall animation for ${entity.player?.username || entity.id}`);
        entity.stopModelAnimations([PLAYER_FALL_ANIMATION]);
        entity.startModelLoopedAnimations([PLAYER_INITIAL_ANIMATION]);
        this.isFalling = false;
        
        // Stop particle trails when not falling
        if (entity.player?.username) {
          ParticleTrailSystem.getInstance().stopTrail(entity.player.username);
        }
      }
    } catch (error) {
      console.error(`[FallingPlayerController] Error managing fall animation for entity ${entity.id}:`, error);
    }

    // Handle movement regardless of animation state
    const moveAmount = (this.moveSpeed * deltaTimeMs) / 1000;
    let dx = 0;
    let dz = 0;
    // Determine if the player intends to move based on input
    const wantsToMove = input.w || input.s || input.a || input.d;

    if (wantsToMove) {
      // Calculate movement direction based on input
      if (input.w) dz -= moveAmount;
      if (input.s) dz += moveAmount;
      if (input.a) dx -= moveAmount;
      if (input.d) dx += moveAmount;

      // Apply movement
      try {
        entity.setPosition({
          x: currentPos.x + dx,
          y: currentPos.y,
          z: currentPos.z + dz
        });
      } catch (error) {
        console.error(`[FallingPlayerController] Error setting position for entity ${entity.id}:`, error);
      }
    }

    // Only handle animations if not falling
    if (!this.isFalling) {
      // Handle animations based on movement state change only if not falling
      try {
        if (wantsToMove && !this.isMoving) {
          // Player started moving this tick
          this.isMoving = true;
          // Use constants for animation names
          entity.stopModelAnimations([PLAYER_INITIAL_ANIMATION]); // Stop idle if it was playing
          entity.startModelLoopedAnimations([PLAYER_WALK_ANIMATION]); // Start walk animation
        } else if (!wantsToMove && this.isMoving) {
          // Player stopped moving this tick
          this.isMoving = false;
          // Use constants for animation names
          entity.stopModelAnimations([PLAYER_WALK_ANIMATION]); // Stop walk animation
          entity.startModelLoopedAnimations([PLAYER_INITIAL_ANIMATION]); // Start idle animation
        }
        // If movement state (wantsToMove vs isMoving) hasn't changed, do nothing with animations.
      } catch (error) {
        // Log errors related to animation calls
        console.error(`[FallingPlayerController] Error managing animations for entity ${entity.id}:`, error);
      }
    }
  }

  // Method to reset the fall flag (NEW)
  // This needs to be called when the player's position is reset
  public resetFallState(): void {
    this.hasFallen = false;
    this.isFalling = false; // Reset falling animation state
    this.hasLanded = false; // Reset landing state
    // console.log(`[FallingPlayerController] Fall state reset.`); // Optional log
  }
  
  // Set that player has landed (NEW)
  public setLanded(landed: boolean): void {
    this.hasLanded = landed;
    console.log(`[FallingPlayerController] Set landing state to: ${landed}`);
  }
}

class AnswerBlocksManager {
  private _blocks: Entity[] = [];
  private _world: World; // Make world accessible if needed later, otherwise keep private
  private _currentQuestion: any = null; // Store current question for Phase 2 systems

  constructor(world: World) {
    this._world = world;
  }
  
  // Method to set current question for Phase 2 systems
  public setCurrentQuestion(question: any): void {
    this._currentQuestion = question;
  }
  
  // Method to get current question for Phase 2 systems
  public getCurrentQuestion(): any {
    return this._currentQuestion;
  }

  // Method to clear existing blocks
  public clearAnswerBlocks(): void {
    console.log(`[AnswerBlocksManager] Clearing ${this._blocks.length} existing blocks.`);
    // Create a copy of the blocks array to avoid modification during iteration
    const blocksToRemove = [...this._blocks];
    blocksToRemove.forEach(block => {
      if (block.isSpawned) {
        console.log(`[AnswerBlocksManager] Despawning block ID: ${block.id}`);
        block.despawn();
      }
    });
    this._blocks = []; // Reset the array after despawning
  }

  // Previous generateAnswerBlocks becomes internal, called by generateForPlayer maybe?
  // Let's keep it simple: generateAnswerBlocks is global for now, but collision checks player state.
  public generateAnswerBlocks(correctAnswer: number, wrongAnswers: number[]): void {
    console.log(`[AnswerBlocksManager] generateAnswerBlocks called with correct: ${correctAnswer}, wrong: [${wrongAnswers.join(', ')}]`);
    
    // Clear existing blocks *before* generating new ones
    this.clearAnswerBlocks(); // Use the new clear method

    // This method now assumes it's generating *the* set of blocks for the current global question/round.
    // The collision logic below will handle player-specific answer checking.

    const answers = [correctAnswer, ...wrongAnswers];
    console.log(`[AnswerBlocksManager] Generating blocks for correct answer: ${correctAnswer}, wrong answers: ${wrongAnswers.join(', ')}`);
    const positions = this._generateBlockPositions(answers.length);

    // Shuffle positions (same as before)
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Create blocks (mostly same as before)
    answers.forEach((answerValue, index) => { // Renamed 'answer' to 'answerValue' to avoid conflict
      // Use modulo for texture selection when answer exceeds available textures (0-15)
      const textureNumber = answerValue > 15 ? answerValue % 16 : answerValue;
      const texturePath = `${ANSWER_BLOCK_TEXTURE_PATH}${textureNumber}.png`;
      console.log(`[AnswerBlocksManager] Using texture ${textureNumber} for answer value ${answerValue}`);
      const blockPosition = positions[index]; // Store position for spawning effect
      console.log(`[AnswerBlocksManager] Creating block ${index}: value=${answerValue}, position=${JSON.stringify(blockPosition)}`);
      

      const block = new Entity({
        blockTextureUri: texturePath,
        blockHalfExtents: ANSWER_BLOCK_HALF_EXTENTS,
        rigidBodyOptions: {
          type: RigidBodyType.FIXED,
          colliders: [{
            shape: ColliderShape.BLOCK,
            halfExtents: ANSWER_BLOCK_HALF_EXTENTS,
            // Modified Collision Handler
            onCollision: (otherEntity: Entity | BlockType, started: boolean) => {
              if (started && otherEntity instanceof PlayerEntity) {
                const player = otherEntity.player;
                const playerState = playerGameStateMap.get(player.username);

                // Check if player exists and game is active for them
                if (!playerState || !playerState.gameActive) {
                  // console.log(`[AnswerBlocksManager] Collision ignored for ${player.username} (game not active or state missing)`);
                  return; // Ignore collision if game not active for this player
                }

                // Check against the player's specific current answer
                if (answerValue === playerState.currentAnswer) {
                  console.log(`[AnswerBlocksManager] Correct answer (${answerValue}) hit by ${player.username}`);
                  this._world.emit('correctAnswer', { player: player });
                } else {
                  console.log(`[AnswerBlocksManager] Wrong answer (${answerValue}) hit by ${player.username}. Correct was: ${playerState.currentAnswer}`);
                  this._world.emit('wrongAnswer', { player: player });
                }

                // Spawn break effect for the hit block
                if (block.isSpawned) {
                  // Get current position just before despawning and explicitly cast to Vector3
                  const currentPosition = block.position as Vector3; 
                  console.log(`[AnswerBlocksManager] Spawning break effect for block ID: ${block.id} at ${JSON.stringify(currentPosition)}`);
                  this._spawnBreakEffect(
                      currentPosition,
                      texturePath,
                      ANSWER_BLOCK_BREAK_FRAGMENTS,
                      ANSWER_BLOCK_BREAK_DURATION_MS
                  );
                  
                  // Despawn only the hit block
                  console.log(`[AnswerBlocksManager] Despawning block ID: ${block.id} after collision with ${player.username}.`);
                  block.despawn();
                  
                  // Remove from the blocks array
                  const blockIndex = this._blocks.indexOf(block);
                  if (blockIndex > -1) {
                    this._blocks.splice(blockIndex, 1);
                  }
                }
              }
            }
          }]
        }
      });

      console.log(`[AnswerBlocksManager] Attempting to spawn block for answer ${answerValue} at position ${JSON.stringify(blockPosition)}, Texture: ${texturePath}`);
      block.spawn(this._world, blockPosition);
      block.setRotation({ x: 0, y: 1, z: 0, w: 0 });
      // Store the answer value with the block for debugging
      (block as any)._answerValue = answerValue;
      this._blocks.push(block);
    });
    console.log(`[AnswerBlocksManager] Spawned ${this._blocks.length} new blocks.`);

    // Spawn power-ups with random chance above answer blocks
    positions.forEach((position) => {
      if (Math.random() < POWERUP_SPAWN_CHANCE) {
        // Randomly select a power-up type
        const PowerUpClass = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        
        // Create and spawn power-up above the answer block
        const powerUp = new PowerUpClass();
        const powerUpPosition = {
          x: position.x,
          y: position.y + POWERUP_SPAWN_Y_OFFSET,
          z: position.z
        };
        
        powerUp.spawn(this._world, powerUpPosition);
        console.log(`[AnswerBlocksManager] Spawned ${PowerUpClass.name} power-up at ${JSON.stringify(powerUpPosition)}`);
      }
    });
  }

  private _generateBlockPositions(count: number): Vector3Like[] {
    const positions: Vector3Like[] = [];
    const spacing = ANSWER_BLOCK_SPACING;
    const startX = -(count - 1) * spacing / 2;

    for (let i = 0; i < count; i++) {
      positions.push({
        x: startX + i * spacing,
        y: ANSWER_BLOCK_Y_POSITION,
        z: 0
      });
    }

    return positions;
  }

  /**
   * Spawns small, temporary fragments to simulate a block breaking.
   * @param position The position where the block broke.
   * @param textureUri The texture of the block that broke.
   */
  private _spawnBreakEffect(position: Vector3, textureUri: string, fragmentCount: number = ANSWER_BLOCK_BREAK_FRAGMENTS, durationMs: number = ANSWER_BLOCK_BREAK_DURATION_MS): void {
    // Determine effect type based on block texture
    let effectType: 'default' | 'explosive' | 'implosion' | 'spiral' = 'default';
    
    if (textureUri.includes('emerald')) {
      effectType = 'spiral'; // Correct answers get a nice spiral effect
    } else if (textureUri.includes('fire')) {
      effectType = 'explosive'; // Wrong answers explode
    }
    
    // Use the Fragment Pool system for optimized fragment management
    FragmentPool.getInstance().spawnBreakEffect(
      position,
      textureUri,
      fragmentCount,
      durationMs,
      ANSWER_BLOCK_BREAK_VELOCITY,
      ANSWER_BLOCK_BREAK_ANGULAR_SPEED,
      effectType
    );
  }
}

class LandingPlatformManager {
    private _world: World;
    private _platformEntities: Entity[] = [];

    constructor(world: World) {
        this._world = world;
    }

    public createPlatform(
        platformCenter: Vector3Like = { x: 0, y: LANDING_PLATFORM_Y, z: 0 },
        size: number = LANDING_PLATFORM_SIZE
    ): void {
        this.cleanup();
        console.log(`[LandingPlatformManager] Creating ${size}x${size} island platform at y=${platformCenter.y}...`);
        
        const halfSize = Math.floor(size / 2);
        
        // Create an invisible physics-only entity for the landing sensor (unchanged)
        const sensorHeight = 5;
        const sensorPos = { 
            x: platformCenter.x, 
            y: platformCenter.y + 20, // Position it higher up for earlier detection and less visibility 
            z: platformCenter.z 
        };
        const sensorCollider = new Entity({
            blockTextureUri: 'assets/blocks/water-still.png', // Subtle texture
            blockHalfExtents: { x: size, y: sensorHeight / 2, z: size },
            rigidBodyOptions: {
                type: RigidBodyType.FIXED,
                colliders: [{
                    shape: ColliderShape.BLOCK,
                    halfExtents: { x: size, y: sensorHeight / 2, z: size },
                    isSensor: true,
                    onCollision: (otherEntity: Entity | BlockType, started: boolean) => {
                        if (started && otherEntity instanceof PlayerEntity) {
                            const player = otherEntity.player;
                            console.log(`[LandingPlatformManager] Player ${player.username} entered landing zone sensor.`);
                        }
                    }
                }]
            }
        });
        sensorCollider.spawn(this._world, sensorPos);
        this._platformEntities.push(sensorCollider);
        
        // Revised island pattern: Central grass, fading to sand/dirt, surrounded by water
        // 0 = water, 1 = sand, 2 = grass, 3 = dirt
        const islandPattern = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 3, 2, 2, 3, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 3, 2, 2, 2, 2, 3, 1, 1, 0, 0],
            [0, 1, 1, 3, 2, 2, 2, 2, 2, 2, 3, 1, 1, 0],
            [0, 1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1, 0],
            [0, 1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1, 0],
            [0, 1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1, 0],
            [0, 1, 1, 3, 2, 2, 2, 2, 2, 2, 3, 1, 1, 0],
            [0, 0, 1, 1, 3, 2, 2, 2, 2, 3, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 3, 2, 2, 3, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ];
        
        // Simplified decoration pattern: A few trees and the landing marker
        // 0 = none, 1 = tree, 4 = landing marker
        const decorPattern = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ];
        
        // Create the flat platform based on the pattern
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const x = platformCenter.x - halfSize + i;
                const z = platformCenter.z - halfSize + j;
                const blockY = platformCenter.y; // Platform is flat
                const blockPos: Vector3Like = { x, y: blockY, z };
                
                let textureUri;
                const terrainType = islandPattern[i][j];
                
                // Select texture based on terrain type
                switch (terrainType) {
                    case 0: textureUri = LANDING_PLATFORM_TEXTURES.WATER; break;
                    case 1: textureUri = LANDING_PLATFORM_TEXTURES.SAND; break;
                    case 2: textureUri = LANDING_PLATFORM_TEXTURES.GRASS; break;
                    case 3: textureUri = LANDING_PLATFORM_TEXTURES.DIRT; break;
                    default: textureUri = LANDING_PLATFORM_TEXTURES.WATER; // Default to water if pattern invalid
                }
                
                // Create platform block
                const platformBlock = new Entity({
                    blockTextureUri: textureUri,
                    blockHalfExtents: LANDING_PLATFORM_BLOCK_HALF_EXTENTS,
                    rigidBodyOptions: {
                        type: RigidBodyType.FIXED,
                        colliders: [{
                            shape: ColliderShape.BLOCK,
                            halfExtents: LANDING_PLATFORM_BLOCK_HALF_EXTENTS,
                            onCollision: (otherEntity: Entity | BlockType, started: boolean) => {
                                if (started && otherEntity instanceof PlayerEntity) {
                                    const player = otherEntity.player;
                                    const playerState = playerGameStateMap.get(player.username);
                                    // Log unchanged, collision logic for landing unchanged
                                    console.log(`[LandingPlatformManager] Collision detected: Player=${player.username}, Position=${JSON.stringify(otherEntity.position)}, IsFinalFall=${playerState?.isFinalFall}, GameActive=${playerState?.gameActive}`);
                                    if (playerState && playerState.isFinalFall) {
                                        console.log(`[LandingPlatformManager] Emitting playerLanded event for ${player.username}`);
                                        this._world.emit('playerLanded', { player: player });
                                    }
                                }
                            }
                        }]
                    }
                });
                
                try {
                    platformBlock.spawn(this._world, blockPos);
                    this._platformEntities.push(platformBlock);
                    
                    // Add decorative elements ON TOP of the platform blocks
                    const decorType = decorPattern[i][j];
                    if (decorType > 0 && terrainType !== 0) { // Don't place decor on water
                        const decorPos = { x: x, y: blockY + 1, z: z }; // Place 1 block higher
                        this._addDecoration(decorPos, decorType);
                    }
                } catch (error) {
                    console.error(`[LandingPlatformManager] Error spawning platform block or decoration:`, error);
                }
            }
        }
        
        console.log(`[LandingPlatformManager] Spawned ${this._platformEntities.length} blocks.`);
    }

    /**
     * Adds a decorative element to the platform
     * @param basePosition The position where the base of the decoration should be placed
     * @param decorationType The type of decoration (1=tree, 4=landing marker)
     */
    private _addDecoration(basePosition: Vector3Like, decorationType: number): void {
        switch (decorationType) {
            case 1: // Tree (using improved simple tree)
                this._createTree(basePosition);
                break;
            case 4: // Landing marker
                this._createLandingMarker(basePosition);
                break;
        }
    }

    /**
     * Creates a slightly improved simple tree decoration
     */
    private _createTree(basePosition: Vector3Like): void {
        // Create trunk (slightly taller)
        const trunkHeight = 3;
        for (let y = 0; y < trunkHeight; y++) {
            const trunkPos = {
                x: basePosition.x,
                y: basePosition.y + y,
                z: basePosition.z
            };
            
            const trunkBlock = new Entity({
                blockTextureUri: LANDING_PLATFORM_TEXTURES.WOOD,
                blockHalfExtents: LANDING_PLATFORM_BLOCK_HALF_EXTENTS,
                rigidBodyOptions: {
                    type: RigidBodyType.FIXED,
                    colliders: [{ shape: ColliderShape.BLOCK, halfExtents: LANDING_PLATFORM_BLOCK_HALF_EXTENTS, isSensor: true }]
                }
            });
            trunkBlock.spawn(this._world, trunkPos);
            this._platformEntities.push(trunkBlock);
        }
        
        // Create leaves (using LEAVES texture, slightly larger canopy)
        const leavesStartHeight = basePosition.y + trunkHeight -1; // Start leaves lower down trunk
        const canopySize = 2; // Radius of canopy
        const canopyHeight = 2; // How many blocks high the canopy is

        for (let yOffset = 0; yOffset < canopyHeight; yOffset++) {
             const currentRadius = canopySize - yOffset; // Taper the canopy upwards
             for (let xOffset = -currentRadius; xOffset <= currentRadius; xOffset++) {
                 for (let zOffset = -currentRadius; zOffset <= currentRadius; zOffset++) {
                     // Skip corners on the top layer for a more rounded look
                     if (yOffset === canopyHeight - 1 && Math.abs(xOffset) === currentRadius && Math.abs(zOffset) === currentRadius) {
                         continue;
                     }
                     // Don't place leaves directly inside the trunk
                     if (xOffset === 0 && zOffset === 0 && yOffset < canopyHeight -1) {
                         continue;
                     }

                     const leavesPos = {
                         x: basePosition.x + xOffset,
                         y: leavesStartHeight + yOffset,
                         z: basePosition.z + zOffset
                     };
                     
                     const leavesBlock = new Entity({
                         blockTextureUri: LANDING_PLATFORM_TEXTURES.LEAVES, // Use LEAVES texture
                         blockHalfExtents: LANDING_PLATFORM_BLOCK_HALF_EXTENTS,
                         rigidBodyOptions: {
                             type: RigidBodyType.FIXED,
                             colliders: [{ shape: ColliderShape.BLOCK, halfExtents: LANDING_PLATFORM_BLOCK_HALF_EXTENTS, isSensor: true }]
                         }
                     });
                     leavesBlock.spawn(this._world, leavesPos);
                     this._platformEntities.push(leavesBlock);
                 }
             }
        }
    }

    /**
     * Creates a landing marker (original implementation)
     */
    private _createLandingMarker(basePosition: Vector3Like): void {
        // Create a vertical column of emerald blocks as a landing marker
        for (let y = 0; y < 5; y++) { // Start from y=0 relative to basePosition
            const markerPos = {
                x: basePosition.x,
                y: basePosition.y + y,
                z: basePosition.z
            };
            
            const markerBlock = new Entity({
                blockTextureUri: 'assets/blocks/emerald-block.png', // Bright green for visibility
                blockHalfExtents: LANDING_PLATFORM_BLOCK_HALF_EXTENTS,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_VELOCITY, // Make it rotate slowly
                    angularVelocity: { x: 0, y: 0.5, z: 0 },
                    colliders: [{ shape: ColliderShape.BLOCK, halfExtents: LANDING_PLATFORM_BLOCK_HALF_EXTENTS, isSensor: true }]
                }
            });
            markerBlock.spawn(this._world, markerPos);
            this._platformEntities.push(markerBlock);
        }
    }

    public cleanup(): void {
        // Cleanup unchanged from original
        if (this._platformEntities.length > 0) {
            console.log(`[LandingPlatformManager] Cleaning up ${this._platformEntities.length} blocks.`);
            this._platformEntities.forEach(entity => { if (entity.isSpawned) entity.despawn(); });
            this._platformEntities = [];
        }
    }
}

class MathGameManager {
  private _answerBlocksManager: AnswerBlocksManager;
  private _landingPlatformManager: LandingPlatformManager;
  private _backgroundMusic: Audio | null = null;
  private _isMusicPlaying: boolean = false;

  constructor(private _world: World, backgroundMusic: Audio) {
    this._answerBlocksManager = new AnswerBlocksManager(_world);
    this._landingPlatformManager = new LandingPlatformManager(_world);
    this._backgroundMusic = backgroundMusic;
    
    // Initialize PowerUpManager
    PowerUpManager.getInstance().initialize(_world);
    
    // Initialize FragmentPool
    FragmentPool.getInstance(100).initialize(_world);
    
    // Initialize ParticleTrailSystem
    ParticleTrailSystem.getInstance().initialize(_world);
    
    // Initialize ScoreVisualizationSystem
    ScoreVisualizationSystem.getInstance().initialize(_world);
    
    // Initialize Phase 2 systems
    CurriculumSystem.getInstance();
    LearningAnalyticsDashboard.getInstance().initialize(_world);
    AchievementSystem.getInstance().initialize(_world);
    AdaptiveDifficultySystem.getInstance().initialize();
    ProgressVisualizationSystem.getInstance().initialize(_world);
    
    // Make answer blocks manager accessible globally for magnet power-up
    (_world as any)._answerBlocksManager = this._answerBlocksManager;

    // Handle player joining
    _world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
      // Create player entity
      const playerEntity = new PlayerEntity({
        player,
        name: 'Player',
        modelUri: PLAYER_MODEL_URI,
        modelScale: PLAYER_MODEL_SCALE,
        modelLoopedAnimations: [PLAYER_INITIAL_ANIMATION],
        controller: new FallingPlayerController(this._world),
        rigidBodyOptions: {
          type: RigidBodyType.DYNAMIC,
          gravityScale: PLAYER_GRAVITY_SCALE,
          linearDamping: PLAYER_LINEAR_DAMPING,
          colliders: [
            {
              shape: ColliderShape.CAPSULE,
              halfHeight: PLAYER_COLLIDER_HALF_HEIGHT,
              radius: PLAYER_COLLIDER_RADIUS,
            }
          ],
        }
      });

      // Camera and spawn logic (unchanged)
      player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
      player.camera.setOffset(PLAYER_CAMERA_OFFSET);
      player.camera.setForwardOffset(PLAYER_CAMERA_FORWARD_OFFSET);
      playerEntity.spawn(_world, PLAYER_SPAWN_POSITION);
      playerEntity.setCollisionGroupsForSolidColliders({
        belongsTo: [CollisionGroup.PLAYER],
        collidesWith: [
          CollisionGroup.BLOCK,
          CollisionGroup.ENTITY,
          CollisionGroup.ENTITY_SENSOR
        ]
      });
      playerEntity.setCollisionGroupsForSensorColliders({
        belongsTo: [CollisionGroup.ENTITY_SENSOR],
        collidesWith: [
          CollisionGroup.BLOCK,
          CollisionGroup.ENTITY
        ]
      });

      // Store player entity and controller reference for resetting state
      const controllerInstance = playerEntity.controller as FallingPlayerController; // Cast for type safety
      playerEntityMap.set(player.username, { entity: playerEntity, controller: controllerInstance }); // Store both

      // Initialize player game state
      playerGameStateMap.set(player.username, {
        score: 0,
        questionsPresented: 0,
        gameActive: false,
        currentAnswer: 0,
        difficulty: 'moderate',
        isFinalFall: false,
        currentGravityScale: PLAYER_GRAVITY_SCALE // Initialize gravity scale
      });
      console.log(`[MathGameManager] Initialized game state for ${player.username}`);
      
      // Initialize Phase 2 systems for player
      CurriculumSystem.getInstance().initializePlayerProgress(player.id);
      LearningAnalyticsDashboard.getInstance().startSession(player.id);
      AchievementSystem.getInstance().initializePlayerProgress(player.id);
      AdaptiveDifficultySystem.getInstance().initializePlayerParameters(player.id);
      ProgressVisualizationSystem.getInstance().initializePlayerVisualization(player.id);
      
      // Initialize Phase 3 systems for player
      console.log(`[MathGameManager] Initializing Phase 3 systems for ${player.username}`);
      GlobalLeaderboardSystem.instance.loadPlayerStats(player);
      SocialFeaturesSystem.instance.loadPlayerProfile(player);
      console.log(`[MathGameManager] Initialized Phase 2 systems for ${player.username}`);

      // Load the UI file for the player
      player.ui.load(UI_INDEX_PATH);
      console.log(`[MathGameManager] Loaded UI for ${player.username}`);
      
      // Send initial score (optional, UI defaults to 0)
      // player.ui.sendData({ type: 'score', score: 0 });

      // --- Add UI Data Listener ---
      player.ui.on(PlayerUIEvent.DATA, ({ playerUI, data }) => {
        console.log(`[MathGameManager] Received UI data from ${player.username}:`, data);
        const playerState = playerGameStateMap.get(player.username);
        // Retrieve player data (entity and controller) for position reset
        const playerData = playerEntityMap.get(player.username);

        if (!playerState || !playerData) {
          console.error(`[MathGameManager] Received UI data for unknown player state or data: ${player.username}`);
          return;
        }

        if (data.type === 'start-game') {
          // Read difficulty from the UI message, default to moderate if missing
          const selectedDifficulty = data.difficulty === 'beginner' || data.difficulty === 'moderate' || data.difficulty === 'hard' 
                                     ? data.difficulty 
                                     : 'moderate'; // Default difficulty
          
          console.log(`[MathGameManager] Start game requested by ${player.username} with difficulty: ${selectedDifficulty}`);
          playerState.score = 0;
          playerState.questionsPresented = 0;
          playerState.gameActive = true;
          playerState.difficulty = selectedDifficulty; // Store the difficulty
          playerState.isFinalFall = false;
          playerState.currentGravityScale = PLAYER_GRAVITY_SCALE; // Reset gravity on start
          playerGameStateMap.set(player.username, playerState); // Update the state in the map

          // Reset position AND fall state on game start
          playerData.entity.setPosition(PLAYER_SPAWN_POSITION);
          playerData.controller.resetFallState(); // Reset fall state here too
          playerData.entity.setGravityScale(PLAYER_GRAVITY_SCALE); // Apply initial gravity

          this.generateNewProblem(player); // Pass player to generate problem
          this._playBackgroundMusic();
          this._landingPlatformManager.cleanup();
        } else if (data.type === 'restart-game') {
          console.log(`[MathGameManager] Restart game requested by ${player.username}`);
          playerState.score = 0;
          playerState.questionsPresented = 0;
          playerState.gameActive = false;
          playerState.isFinalFall = false;
          playerState.currentGravityScale = PLAYER_GRAVITY_SCALE; // Reset gravity on restart
          playerGameStateMap.set(player.username, playerState);
          this._answerBlocksManager.clearAnswerBlocks();
          this._stopBackgroundMusicIfLastPlayer();
          this._landingPlatformManager.cleanup();
          player.ui.sendData({ type: 'show-start' });
          // Apply reset gravity scale if player entity still exists
          if (playerData && playerData.entity.isSpawned) {
            playerData.entity.setGravityScale(PLAYER_GRAVITY_SCALE);
          }
        }
        
        // Handle progress display requests
        if (data.type === 'show-progress') {
          console.log(`[MathGameManager] Progress display requested by ${player.username}`);
          const playerEntity = playerData.entity;
          ProgressVisualizationSystem.getInstance().displayProgressSummary(playerEntity);
        }
        
        // Handle analytics dashboard requests
        if (data.type === 'show-analytics') {
          console.log(`[MathGameManager] Analytics dashboard requested by ${player.username}`);
          const playerEntity = playerData.entity;
          LearningAnalyticsDashboard.getInstance().displayDashboard(playerEntity);
        }
        
        // Add handlers for other potential UI messages if needed
      });
      // --- End UI Data Listener ---

      // --- Spawn Flying Plane (Only for first player) ---
      // REMOVED - Plane animation moved to UI (index.html)
      // if (!planeSpawned) {
      //   console.log('[MathGameManager] First player joined, creating flying plane...');
      //   const planeEntity = new Entity({
      //     modelUri: 'models/items/plane.gltf', // Path to the plane model
      //     rigidBodyOptions: {
      //       type: RigidBodyType.KINEMATIC_VELOCITY, // Moves based on velocity, ignores gravity/collisions
      //       linearVelocity: { x: 10, y: 0, z: 0 }, // Slower speed for testing
      //       colliders: [{ // Add a sensor collider so it doesn't physically block anything
      //         shape: ColliderShape.BLOCK, // Corrected from BOX to BLOCK
      //         halfExtents: { x: 1, y: 0.5, z: 1 }, // Adjust size based on the model
      //         isSensor: true 
      //       }]
      //     }
      //   });

      //   // Set initial position (closer and lower for testing) and rotation (face forward)
      //   const planeStartPosition: Vector3Like = { x: -50, y: 40, z: 10 }; // Closer start position
      //   const planeRotation = { x: 0, y: 0.707, z: 0, w: 0.707 }; // Rotate 90 degrees on Y axis to face positive X

      //   try {
      //     planeEntity.spawn(this._world, planeStartPosition); // Use this._world here
      //     planeEntity.setRotation(planeRotation);
      //     planeSpawned = true; // Set the flag so it doesn't spawn again
      //     console.log(`[MathGameManager] Flying plane spawned for the first player at ${JSON.stringify(planeStartPosition)}.`);
          
      //     // Optional: Despawn the plane after a longer time if it flies out of view
      //     setTimeout(() => {
      //       if (planeEntity.isSpawned) {
      //         planeEntity.despawn();
      //         console.log('[MathGameManager] Flying plane despawned after timeout.');
      //       }
      //     }, 60000); // Despawn after 60 seconds for testing

      //   } catch (error) {
      //     console.error('[MathGameManager] Error spawning or rotating flying plane:', error);
      //   }
      // }
      // --- End Spawn Flying Plane ---

      // Do NOT generate first problem here anymore
      // this.generateNewProblem(); 
    });

    // Handle player leaving
    _world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
      console.log(`[MathGameManager] Player ${player.username} left.`);
      // Retrieve the stored object
      const playerData = playerEntityMap.get(player.username);
      if (playerData) {
        playerData.entity.despawn(); // Despawn the entity
        playerEntityMap.delete(player.username); // Delete the entry from the map
      } else {
         console.warn(`[MathGameManager] Could not find player data for leaving player ${player.username}`);
      }
      // Remove player game state
      const playerState = playerGameStateMap.get(player.username);
      if (playerState?.isFinalFall) {
        console.log(`[MathGameManager] Player ${player.username} left during final fall. Cleaning up platform.`);
        this._landingPlatformManager.cleanup();
      }
      playerGameStateMap.delete(player.username);
      console.log(`[MathGameManager] Cleaned up state for ${player.username}.`);
      
      // Clean up particle trails
      ParticleTrailSystem.getInstance().stopTrail(player.username);
      
      // Clean up Phase 2 systems
      LearningAnalyticsDashboard.getInstance().endSession(player.id);
      ProgressVisualizationSystem.getInstance().cleanupPlayerVisualization(player.id);
      console.log(`[MathGameManager] Cleaned up Phase 2 systems for ${player.username}.`);
      
      // Clean up Phase 3 systems
      SocialFeaturesSystem.instance.onPlayerDisconnect(player);
      console.log(`[MathGameManager] Cleaned up Phase 3 systems for ${player.username}.`);
      
      // Clean up score visualizations
      ScoreVisualizationSystem.getInstance().cleanup();
      
      // If this was the last player, maybe clear blocks?
      if (playerEntityMap.size === 0) {
         console.log(`[MathGameManager] Last player left, clearing answer blocks.`);
         this._answerBlocksManager.clearAnswerBlocks();
         // --- Stop Background Music ---
         this._stopBackgroundMusic(); 
         this._landingPlatformManager.cleanup();
      } else {
         // Check if the leaving player was the *last* active player
         this._stopBackgroundMusicIfLastPlayer();
      }
    });

    // Handle correct answers
    _world.on('correctAnswer', ({ player }) => {
        const playerData = playerEntityMap.get(player.username);
        const playerState = playerGameStateMap.get(player.username);

        if (!playerData || !playerState || !playerState.gameActive) {
            // console.log(`[MathGameManager] Correct answer event ignored for ${player.username} (inactive/missing state).`);
            return;
        }
        const playerEntity = playerData.entity;
        const controller = playerData.controller;

        console.log(`[MathGameManager] Correct answer processed for ${player.username}.`);

        // --- Logic before timeout ---
        // Increment score and questions presented (with power-up multiplier)
        const scoreMultiplier = DoublePointsPowerUp.getScoreMultiplier(player.username);
        playerState.score += scoreMultiplier;
        playerState.questionsPresented++; // Increment happens here
        
        // Create floating score visualization
        ScoreVisualizationSystem.getInstance().createFloatingScore(
          playerEntity.position,
          scoreMultiplier,
          'correct',
          1.2
        );
        
        // Add screen shake for big scores
        if (scoreMultiplier > 1) {
          ScoreVisualizationSystem.getInstance().createScreenShakeEffect(playerEntity, 0.5);
        }
        
        // Phase 2 system integration for correct answers
        const currentQuestion = this._answerBlocksManager.getCurrentQuestion();
        if (currentQuestion) {
          // Record curriculum progress
          CurriculumSystem.getInstance().recordAnswer(player.id, currentQuestion.id || 'unknown', currentQuestion.answer, 1000);
          
          // Record analytics
          LearningAnalyticsDashboard.getInstance().recordQuestionAttempt(player.id, currentQuestion.topic || 'basic_arithmetic', true, 1000);
          
          // Record achievement progress
          AchievementSystem.getInstance().recordAction(player.id, 'correct_answer', { 
            topic: currentQuestion.topic || 'basic_arithmetic', 
            responseTime: 1000 
          });
          
          // Record adaptive difficulty
          AdaptiveDifficultySystem.getInstance().recordQuestionAttempt(
            player.id, 
            currentQuestion.id || 'unknown', 
            currentQuestion.topic || 'basic_arithmetic', 
            'intermediate', 
            true, 
            1000
          );
          
          // Check for achievement notifications
          const notifications = AchievementSystem.getInstance().getPendingNotifications(player.id);
          notifications.forEach(notification => {
            ProgressVisualizationSystem.getInstance().showAchievementNotification(playerEntity, notification);
          });
          
          // Phase 3: Update multiplayer systems for correct answers
          CompetitiveRaceManager.instance.handleAnswerSubmit(player, true);
          TeamChallengeManager.instance.handleTeamAnswer(player, true, 100); // 100 time bonus
          GlobalLeaderboardSystem.instance.updatePlayerGameStats(player, {
            questionsAnswered: 1,
            correctAnswers: 1,
            score: scoreMultiplier,
            streak: playerState.questionsPresented
          });
        }

        // --- NEW: Increase Gravity (Only for Moderate/Hard) ---
        if (playerState.difficulty !== 'beginner') {
          const maxGravity = PLAYER_GRAVITY_SCALE * MAX_GRAVITY_MULTIPLIER;
          let newGravityScale = playerState.currentGravityScale + GRAVITY_INCREASE_PER_CORRECT;
          newGravityScale = Math.min(newGravityScale, maxGravity); // Cap at max
          playerState.currentGravityScale = newGravityScale;
          console.log(`[MathGameManager] Correct answer for ${player.username} (${playerState.difficulty}). Increasing gravity scale to ${newGravityScale.toFixed(2)} (Max: ${maxGravity.toFixed(2)})`);
          playerData.entity.setGravityScale(newGravityScale); // Apply new gravity scale
        } else {
          // For beginner, ensure gravity remains at the base level
          playerState.currentGravityScale = PLAYER_GRAVITY_SCALE;
          playerData.entity.setGravityScale(PLAYER_GRAVITY_SCALE);
          console.log(`[MathGameManager] Correct answer for ${player.username} (beginner). Gravity scale remains at ${PLAYER_GRAVITY_SCALE}`);
        }
        // --- END NEW ---

        playerGameStateMap.set(player.username, playerState); // Update state immediately

        // Play sound
        try {
            console.log(`[MathGameManager] Attempting to play correct sound ${AUDIO_SFX_CORRECT} for ${player.username}`);
            const correctSfx = new Audio({ uri: AUDIO_SFX_CORRECT, loop: false, volume: AUDIO_SFX_VOLUME, attachedToEntity: playerEntity, referenceDistance: AUDIO_SFX_REFERENCE_DISTANCE });
            correctSfx.play(this._world);
            console.log(`[MathGameManager] Successfully played correct sound for ${player.username}`);
        } catch (error) {
            console.error(`[MathGameManager] Error playing ${AUDIO_SFX_CORRECT} for ${player.username}:`, error);
        }

        // Spawn correct answer effect
        this.spawnTemporaryEffect(playerEntity, EFFECT_BLOCK_CORRECT_TEXTURE);
        // --- End logic before timeout ---


        // --- Game End / Next Question Logic (ONLY inside timeout) ---
        setTimeout(() => {
            // *** DIAGNOSTIC LOG *** (Keep for now)
            console.log(`[MathGameManager DEBUG] Timeout correct answer: Player ${player.username}, Qs Presented: ${playerState.questionsPresented}, Max: ${MAX_QUESTIONS}`);

            // Re-fetch state IN CASE it changed (though unlikely in 200ms unless player leaves)
            const currentState = playerGameStateMap.get(player.username);
            if (!currentState || !currentState.gameActive) {
                 console.log(`[MathGameManager DEBUG] Player ${player.username} became inactive during timeout (correct answer).`);
                 return; // Don't proceed if game became inactive during delay
            }


            // Check for game end condition *INSIDE* the timeout
            if (currentState.questionsPresented >= MAX_QUESTIONS) {
                // --- Start Final Fall Sequence ---
                // *** DIAGNOSTIC LOG ***
                console.log(`[MathGameManager DEBUG] Starting final fall sequence for ${player.username} (Correct Answer).`);
                currentState.isFinalFall = true;
                playerGameStateMap.set(player.username, currentState); // Update final fall state

                // Spawn the landing platform
                console.log(`[MathGameManager DEBUG] Calling createPlatform for ${player.username}.`);
                this._landingPlatformManager.createPlatform();
                console.log(`[MathGameManager DEBUG] Finished calling createPlatform for ${player.username}.`);

                // Reset position to start the final fall
                controller.resetFallState();
                
                // Explicitly set player position a bit above the answer blocks for dramatic fall
                const finalFallPosition = { 
                    x: 0, // Center at zero to aim for the landing marker
                    y: ANSWER_BLOCK_Y_POSITION + 100, // Position much higher for a longer, more dramatic fall
                    z: 0  // Center at zero to aim for the landing marker
                };
                playerData.entity.setPosition(finalFallPosition);
                
                // Set a fixed downward velocity for consistent fall
                playerData.entity.setLinearVelocity({ x: 0, y: -20, z: 0 });
                
                // Explicitly set the falling animation for the final fall
                playerData.entity.stopModelAnimations([PLAYER_INITIAL_ANIMATION, PLAYER_WALK_ANIMATION]);
                playerData.entity.startModelLoopedAnimations([PLAYER_FALL_ANIMATION]);
                
                // Start particle trails for final fall with more intense effects
                ParticleTrailSystem.getInstance().startTrail(playerData.entity, player.username, ['sparkleTrail', 'speedTrail', 'windTrail']);
                
                // Start visual effects for the fall
                this._createFallingEffects(player, 3000);

                console.log(`[MathGameManager] Landing platform spawned for ${player.username}. Final fall from Y=${finalFallPosition.y} to platform Y=${LANDING_PLATFORM_Y}.`);
                // --- End Final Fall Sequence Start ---
            } else {
                // Game continues: Reset position, reset fall state, generate next problem
                 const currentPlayerData = playerEntityMap.get(player.username); // Re-fetch in case player left
                 if (currentPlayerData) {
                    currentPlayerData.entity.setPosition(PLAYER_RESET_POSITION);
                    (currentPlayerData.controller as FallingPlayerController).resetFallState(); // Need to cast here
                    this.generateNewProblem(player);
                 } else {
                     console.log(`[MathGameManager DEBUG] Player ${player.username} left during timeout (correct answer - next question).`);
                 }
            }
        }, GAME_RESET_DELAY_MS);
        // --- END Game End / Next Question Logic ---

        // REMOVED ANY LOGIC HERE THAT CHECKED QUESTIONS_PRESENTED or ended the game
    });

    // Handle wrong answers
    _world.on('wrongAnswer', ({ player }) => {
        const playerData = playerEntityMap.get(player.username);
        const playerState = playerGameStateMap.get(player.username);

        // Ignore if player is in final fall or inactive
        if (!playerData || !playerState || !playerState.gameActive || playerState.isFinalFall) {
            // ... existing logs ...
            return;
        }
        const playerEntity = playerData.entity;
        const controller = playerData.controller;

        console.log(`[MathGameManager] Wrong answer processed for ${player.username}. Questions presented: ${playerState.questionsPresented}/${MAX_QUESTIONS}`);
        
        // Create floating "wrong" visualization
        ScoreVisualizationSystem.getInstance().createFloatingScore(
          playerEntity.position,
          0,
          'wrong',
          1.5
        );

        // Check for Shield protection
        if (ShieldBubblePowerUp.consumeShield(player.username)) {
          console.log(`[MathGameManager] Shield protected ${player.username} from wrong answer!`);
          // Skip all penalties - just continue to next question
          setTimeout(() => {
            const currentState = playerGameStateMap.get(player.username);
            if (currentState && currentState.gameActive) {
              this.generateNewProblem(player);
            }
          }, GAME_RESET_DELAY_MS);
          return;
        }

        // Record wrong answer for potential rewind
        RewindPowerUp.recordWrongAnswer(player.username);

        // --- Logic before timeout ---
        // Increment questions presented, but not score
        playerState.questionsPresented++; // Increment happens here
        playerGameStateMap.set(player.username, playerState); // Update state immediately
        
        // Phase 2 system integration for wrong answers
        const currentQuestion = this._answerBlocksManager.getCurrentQuestion();
        if (currentQuestion) {
          // Record curriculum progress (wrong answer)
          CurriculumSystem.getInstance().recordAnswer(player.id, currentQuestion.id || 'unknown', -1, 2000);
          
          // Record analytics (wrong answer)
          LearningAnalyticsDashboard.getInstance().recordQuestionAttempt(player.id, currentQuestion.topic || 'basic_arithmetic', false, 2000);
          
          // Record achievement progress (wrong answer)
          AchievementSystem.getInstance().recordAction(player.id, 'wrong_answer', { 
            topic: currentQuestion.topic || 'basic_arithmetic', 
            responseTime: 2000 
          });
          
          // Record adaptive difficulty (wrong answer)
          AdaptiveDifficultySystem.getInstance().recordQuestionAttempt(
            player.id, 
            currentQuestion.id || 'unknown', 
            currentQuestion.topic || 'basic_arithmetic', 
            'intermediate', 
            false, 
            2000
          );
          
          // Phase 3: Update multiplayer systems for wrong answers
          CompetitiveRaceManager.instance.handleAnswerSubmit(player, false);
          TeamChallengeManager.instance.handleTeamAnswer(player, false, 0); // No time bonus
          GlobalLeaderboardSystem.instance.updatePlayerGameStats(player, {
            questionsAnswered: 1,
            correctAnswers: 0,
            score: 0
          });
        }

        // --- NEW: Reset Gravity ---
        playerState.currentGravityScale = PLAYER_GRAVITY_SCALE; // Reset to default
        console.log(`[MathGameManager] Wrong answer for ${player.username}. Resetting gravity scale to ${PLAYER_GRAVITY_SCALE}`);
        playerData.entity.setGravityScale(PLAYER_GRAVITY_SCALE); // Apply default gravity scale
        // --- END NEW ---

        // Play sound
        try {
            console.log(`[MathGameManager] Attempting to play wrong sound ${AUDIO_SFX_WRONG} for ${player.username}`);
            const wrongSfx = new Audio({ uri: AUDIO_SFX_WRONG, loop: false, volume: AUDIO_SFX_VOLUME, attachedToEntity: playerEntity, referenceDistance: AUDIO_SFX_REFERENCE_DISTANCE });
            wrongSfx.play(this._world);
            console.log(`[MathGameManager] Successfully played wrong sound for ${player.username}`);
        } catch (error) {
            console.error(`[MathGameManager] Error playing ${AUDIO_SFX_WRONG} for ${player.username}:`, error);
        }

        // Spawn wrong answer effect
        this.spawnTemporaryEffect(playerEntity, EFFECT_BLOCK_WRONG_TEXTURE);
        // --- End logic before timeout ---

        // --- Game End / Next Question Logic (ONLY inside timeout) ---
        setTimeout(() => {
            // *** DIAGNOSTIC LOG *** (Keep for now)
            console.log(`[MathGameManager DEBUG] Timeout wrong answer: Player ${player.username}, Qs Presented: ${playerState.questionsPresented}, Max: ${MAX_QUESTIONS}`);

            // Re-fetch state IN CASE it changed
            const currentState = playerGameStateMap.get(player.username);
             if (!currentState || !currentState.gameActive) {
                 console.log(`[MathGameManager DEBUG] Player ${player.username} became inactive during timeout (wrong answer).`);
                 return; // Don't proceed if game became inactive during delay
            }

            // Check for game end condition *INSIDE* the timeout
            if (currentState.questionsPresented >= MAX_QUESTIONS) {
                // --- Start Final Fall Sequence ---
                console.log(`[MathGameManager DEBUG] Starting final fall sequence for ${player.username} (Wrong Answer).`);
                currentState.isFinalFall = true;
                playerGameStateMap.set(player.username, currentState); // Update final fall state

                // Spawn the landing platform
                console.log(`[MathGameManager DEBUG] Calling createPlatform for ${player.username}.`);
                this._landingPlatformManager.createPlatform();
                console.log(`[MathGameManager DEBUG] Finished calling createPlatform for ${player.username}.`);

                // Reset position to start the final fall
                controller.resetFallState();
                
                // Explicitly set player position a bit above the answer blocks for dramatic fall
                const finalFallPosition = { 
                    x: 0, // Center at zero to aim for the landing marker
                    y: ANSWER_BLOCK_Y_POSITION + 100, // Position much higher for a longer, more dramatic fall
                    z: 0  // Center at zero to aim for the landing marker
                };
                playerData.entity.setPosition(finalFallPosition);
                
                // Set a fixed downward velocity for consistent fall
                playerData.entity.setLinearVelocity({ x: 0, y: -20, z: 0 });
                
                // Explicitly set the falling animation for the final fall
                playerData.entity.stopModelAnimations([PLAYER_INITIAL_ANIMATION, PLAYER_WALK_ANIMATION]);
                playerData.entity.startModelLoopedAnimations([PLAYER_FALL_ANIMATION]);
                
                // Start particle trails for final fall with more intense effects
                ParticleTrailSystem.getInstance().startTrail(playerData.entity, player.username, ['sparkleTrail', 'speedTrail', 'windTrail']);
                
                // Start visual effects for the fall
                this._createFallingEffects(player, 3000);

                console.log(`[MathGameManager] Landing platform spawned for ${player.username}. Final fall from Y=${finalFallPosition.y} to platform Y=${LANDING_PLATFORM_Y}.`);
                // --- End Final Fall Sequence Start ---
            } else {
                // Game continues: Reset position, reset fall state, generate next problem
                 const currentPlayerData = playerEntityMap.get(player.username); // Re-fetch in case player left
                 if (currentPlayerData) {
                    currentPlayerData.entity.setPosition(PLAYER_RESET_POSITION);
                    (currentPlayerData.controller as FallingPlayerController).resetFallState(); // Need to cast here
                    this.generateNewProblem(player);
                 } else {
                     console.log(`[MathGameManager DEBUG] Player ${player.username} left during timeout (wrong answer - next question).`);
                 }
            }
        }, GAME_RESET_DELAY_MS);
        // --- END Game End / Next Question Logic ---

         // REMOVED ANY LOGIC HERE THAT CHECKED QUESTIONS_PRESENTED or ended the game
    });

    // --- Handle Player Landing Event ---
    _world.on('playerLanded', ({ player }) => {
        console.log(`[MathGameManager DEBUG] 'playerLanded' event handler started for ${player.username}.`);
        const playerData = playerEntityMap.get(player.username);
        const playerState = playerGameStateMap.get(player.username);

        if (!playerData || !playerState || !playerState.isFinalFall) {
             if (playerState && !playerState.isFinalFall) {
                console.log(`[MathGameManager DEBUG] Player landed event ignored for ${player.username} (NOT in final fall state). State: ${JSON.stringify(playerState)}`);
             } else {
                console.warn(`[MathGameManager DEBUG] Player landed event received for unknown or non-final-fall player: ${player.username}. PlayerData: ${!!playerData}, PlayerState: ${!!playerState}`);
             }
            return;
        }

        console.log(`[MathGameManager] Player ${player.username} successfully landed. Processing game over.`);
        const finalScore = playerState.score;
        
        // Create final score burst visualization
        ScoreVisualizationSystem.getInstance().createScoreBurst(
          playerData.entity.position,
          [finalScore, finalScore, finalScore], // Triple burst for final score
          'bonus'
        );
        
        // Screen shake for game completion
        ScoreVisualizationSystem.getInstance().createScreenShakeEffect(playerData.entity, 1.0);

        // Set the hasLanded flag in the controller to prevent downward rotation
        playerData.controller.setLanded(true);

        // Change animation to landing animation (player on feet) instead of staying in fall animation
        try {
          // First stop fall animation
          playerData.entity.stopModelAnimations([PLAYER_FALL_ANIMATION]);
          
          // Explicitly set upright rotation BEFORE starting landing animation
          const uprightRotation = { x: 0, y: 0, z: 0, w: 1 }; // Quaternion for upright position
          playerData.entity.setRotation(uprightRotation);
          console.log(`[MathGameManager] Reset rotation to upright for ${player.username}`);
          
          // Start landing animation
          playerData.entity.startModelLoopedAnimations([PLAYER_LAND_ANIMATION]);
          
          // After short delay, transition to idle animation
          setTimeout(() => {
            playerData.entity.stopModelAnimations([PLAYER_LAND_ANIMATION]);
            playerData.entity.startModelLoopedAnimations([PLAYER_INITIAL_ANIMATION]);
            
            // Set rotation again to ensure it's upright
            playerData.entity.setRotation(uprightRotation);
          }, 1000);
        } catch (error) {
          console.error(`[MathGameManager] Error setting landing animation for ${player.username}:`, error);
        }

        // Update state
        playerState.isFinalFall = false;
        playerState.gameActive = false;
        playerState.score = 0;
        playerState.questionsPresented = 0;
        playerState.currentGravityScale = PLAYER_GRAVITY_SCALE; // Reset gravity on landing
        playerGameStateMap.set(player.username, playerState);

        // Play sound
        try {
          const landingSfx = new Audio({
            uri: AUDIO_SFX_LANDING,
            loop: false,
            volume: AUDIO_SFX_VOLUME,
            attachedToEntity: playerData.entity,
            referenceDistance: AUDIO_SFX_REFERENCE_DISTANCE
          });
          landingSfx.play(this._world);
        } catch (error) {
          console.error(`[MathGameManager] Error playing ${AUDIO_SFX_LANDING} for ${player.username}:`, error);
        }
        
        // Stop particle trails and create landing burst effect
        ParticleTrailSystem.getInstance().stopTrail(player.username);
        ParticleTrailSystem.getInstance().createBurst(playerData.entity.position, 'landing');

        // Add a longer delay before showing game over screen
        // This gives time for landing effects and sounds to play
        // and accounts for the much longer fall time
        const GAME_OVER_DELAY_MS = 4000; // 4 seconds delay for the longer fall
        console.log(`[MathGameManager] Adding ${GAME_OVER_DELAY_MS}ms delay before showing game over screen.`);
        
        setTimeout(() => {
            // Send game over message to UI after delay
            player.ui.sendData({
              type: 'game-over',
              score: finalScore,
              maxQuestions: MAX_QUESTIONS
            });
        
            // Stop music if needed
            this._stopBackgroundMusicIfLastPlayer();
        
            // Clean up only after showing game over
            this._landingPlatformManager.cleanup();
            this._answerBlocksManager.clearAnswerBlocks();
        
            console.log(`[MathGameManager] Game over sequence complete for ${player.username}. Final score: ${finalScore}/${MAX_QUESTIONS}`);
        }, GAME_OVER_DELAY_MS);
    });

  } // End Constructor

  // Modified to accept player argument
  private generateNewProblem(player: Player): void {
    const playerState = playerGameStateMap.get(player.username);
     if (!playerState || !playerState.gameActive) {
        console.log(`[MathGameManager] generateNewProblem called for inactive player ${player.username}, ignoring.`);
        return; // Don't generate if game isn't active for this player
     }
     
     console.log(`[MathGameManager] Generating new problem for ${player.username}, question #${playerState.questionsPresented + 1}, difficulty: ${playerState.difficulty}`);
     
     // Check if we should use adaptive curriculum questions
     const adaptiveQuestions = AdaptiveDifficultySystem.getInstance().getAdaptiveQuestions(player.id, 1);
     console.log(`[MathGameManager] Adaptive system returned ${adaptiveQuestions.length} questions for ${player.username}`);
     if (adaptiveQuestions.length > 0) {
       const question = adaptiveQuestions[0];
       console.log(`[MathGameManager] Using adaptive curriculum question for ${player.username}: ${question.question}`);
       
       // Store the correct answer IN THE PLAYER'S STATE
       playerState.currentAnswer = question.correctAnswer;
       playerGameStateMap.set(player.username, playerState); // Update map
       
       // Store the question for answer validation
       this._answerBlocksManager.setCurrentQuestion(question);
       
       // Generate answer blocks
       this._answerBlocksManager.generateAnswerBlocks(question.correctAnswer, question.wrongAnswers);
       
       // Parse the question to extract numbers and operation for UI display
       const questionParts = question.question.split(' ');
       let num1 = '?', operation = '?', num2 = '?';
       
       if (questionParts.length >= 3) {
         // Handle word problems differently
         if (question.question.length > 20) {
           // For word problems, display the full question text in a simplified way
           num1 = 'Word';
           operation = '?';
           num2 = 'Problem';
         } else {
           // For regular math problems like "25 × 16 = ?"
           num1 = questionParts[0];
           operation = questionParts[1];
           num2 = questionParts[2];
         }
       }
       
       // Update UI with the parsed question
       player.ui.sendData({
         type: 'problem',
         num1: num1,
         operation: operation,
         num2: num2
       });

       // Emit newMathProblem event for Phase 4 accessibility features (if not a word problem)
       if (num1 !== 'Word' && operation !== '?' && num2 !== 'Problem') {
         try {
           const n1 = parseInt(num1);
           const n2 = parseInt(num2);
           if (!isNaN(n1) && !isNaN(n2)) {
             this._world.emit('newMathProblem', { num1: n1, operator: operation, num2: n2 });
           }
         } catch (e) {
           // For complex questions, just emit a generic notification
           this._world.emit('newMathProblem', { num1: 0, operator: '?', num2: 0 });
         }
       }
       
       // Record session activity
       AchievementSystem.getInstance().recordAction(player.id, 'question_answered');
       
       return;
     }
     
     // Fallback to original problem generation if no adaptive questions available
     
     // --- Difficulty Adjustments ---
     const difficulty = playerState.difficulty;
     let allowedOps: string[];
     let problemMaxValue: number;
     let wrongAnswerRange: number;
     let wrongAnswerMax: number;
     // Keep original constants for hard division
     const hardDivAnswerMax = MATH_PROBLEM_MAX_VALUE_DIV_ANSWER;
     const hardDivDivisorMax = MATH_PROBLEM_MAX_VALUE_DIV_DIVISOR;
     const hardDivNum1Max = MATH_PROBLEM_MAX_VALUE_DIV_NUM1;

     switch (difficulty) {
       case 'beginner':
         allowedOps = ['+', '-'];
         problemMaxValue = 5;
         wrongAnswerRange = 2;
         wrongAnswerMax = 5;
         break;
       case 'moderate':
         allowedOps = ['+', '-', '*'];
         problemMaxValue = 5; // Reduced to keep multiplication results <= 15
         wrongAnswerRange = 5;
         wrongAnswerMax = 15; // Cap at available texture range
         break;
       case 'hard':
       default:
         allowedOps = ['+', '-', '*', '/']; // Use original full list
         problemMaxValue = 15; // Use a general max for non-division hard
         wrongAnswerRange = WRONG_ANSWER_RANGE; // Original: 10
         wrongAnswerMax = WRONG_ANSWER_MAX_VALUE; // Original: 15
         // Division uses its specific harder constants
         break;
     }
     console.log(`[MathGameManager] Generating problem for difficulty: ${difficulty}. Allowed Ops: ${allowedOps.join(', ')}. Max Value: ${problemMaxValue}`);
     // --- End Difficulty Adjustments ---

    // Logic for generating num1, num2, answer, operation
    // Select operation ONLY from the allowed list for the difficulty
    let operation = allowedOps[Math.floor(Math.random() * allowedOps.length)];
    let num1: number = 0, num2: number = 0, answer: number = 0;
    let isValid = false;
    let generationAttempts = 0; // Safety break for problem generation
    while (!isValid && generationAttempts < 100) {
      generationAttempts++;
      // Use difficulty-based max values and allowed operations
      switch (operation) {
          case '+':
              num1 = Math.floor(Math.random() * (problemMaxValue + 1)); 
              // Ensure num2 doesn't make the answer exceed maxProblemValue
              num2 = Math.floor(Math.random() * (problemMaxValue - num1 + 1)); 
              answer = num1 + num2;
              isValid = true;
              break;
          case '-':
              num1 = Math.floor(Math.random() * (problemMaxValue + 1));
              // Ensure num2 is less than or equal to num1
              num2 = Math.floor(Math.random() * (num1 + 1)); 
              answer = num1 - num2;
              isValid = true;
              break;
          case '*': // Only available for Moderate and Hard
              // For moderate difficulty, ensure multiplication results stay within texture range
              if (difficulty === 'moderate') {
                  // Keep it simple: use smaller numbers for multiplication
                  num1 = Math.floor(Math.random() * 4) + 1; // 1-3
                  num2 = Math.floor(Math.random() * 6); // 0-5
                  answer = num1 * num2;
                  // Ensure answer doesn't exceed 15
                  if (answer > 15) {
                      num2 = Math.floor(15 / num1);
                      answer = num1 * num2;
                  }
              } else {
                  // Original logic for hard mode
                  num1 = Math.floor(Math.random() * (problemMaxValue + 1)); 
                  if (num1 === 0) {
                      // Allow num2 to be anything up to max if num1 is 0
                      num2 = Math.floor(Math.random() * (problemMaxValue + 1)); 
                  } else {
                      // Ensure answer doesn't exceed maxProblemValue
                      const maxNum2 = Math.floor(problemMaxValue / num1);
                      num2 = Math.floor(Math.random() * (maxNum2 + 1)); 
                  }
                  answer = num1 * num2;
              }
              isValid = true;
              break;
          case '/': // Only available for Hard
              // Use specific hard division constants for generation
              answer = Math.floor(Math.random() * (hardDivAnswerMax + 1));
              num2 = Math.floor(Math.random() * hardDivDivisorMax) + 1; // Divisor 1 to MAX
              num1 = answer * num2;
              // Check if the generated num1 is within the allowed range for hard division
              if (num1 <= hardDivNum1Max) { 
                  isValid = true;
              } 
              // If not valid, the loop continues to try another operation/numbers
              break;
      }
    }

    if (!isValid) {
        console.error(`[MathGameManager] Failed to generate a valid problem after ${generationAttempts} attempts for difficulty ${difficulty}. Falling back to simple addition.`);
        // Fallback logic (simple addition within the difficulty's max value)
        num1 = Math.floor(Math.random() * (problemMaxValue + 1));
        num2 = Math.floor(Math.random() * (problemMaxValue - num1 + 1));
        operation = '+'; // Force operation to '+' for fallback
        answer = num1 + num2;
    }

    // Store the correct answer IN THE PLAYER'S STATE
    playerState.currentAnswer = answer;
    playerGameStateMap.set(player.username, playerState); // Update map

    // Generate wrong answers (using difficulty-adjusted range/max)
    const wrongAnswers = this._generateWrongAnswers(answer, WRONG_ANSWER_COUNT, wrongAnswerRange, wrongAnswerMax);

    // Create/Update answer blocks (global for now)
    this._answerBlocksManager.generateAnswerBlocks(answer, wrongAnswers);

    // Update UI ONLY for the specific player
    player.ui.sendData({
      type: 'problem',
      num1,
      num2,
      operation // Send the operation symbol
    });

    // Emit newMathProblem event for Phase 4 accessibility features
    this._world.emit('newMathProblem', { num1, operator: operation, num2 });

    // Log for debugging
    console.log(`[MathGameManager] Generated new problem for ${player.username} (Difficulty: ${difficulty}): ${num1} ${operation} ${num2} = ${answer}. Wrong answers range/max: ${wrongAnswerRange}/${wrongAnswerMax}`);
    console.log(`[MathGameManager] Player ${player.username} expected answer stored: ${playerState.currentAnswer}`);
  }

  // Modified to accept difficulty-based range and max value
  private _generateWrongAnswers(correctAnswer: number, count: number = WRONG_ANSWER_COUNT, range: number = WRONG_ANSWER_RANGE, maxVal: number = WRONG_ANSWER_MAX_VALUE): number[] {
    console.log(`[MathGameManager] _generateWrongAnswers called: correctAnswer=${correctAnswer}, count=${count}, range=${range}, maxVal=${maxVal}`);
    const wrongAnswers = new Set<number>();
    let attempts = 0; // Attempt counter to prevent infinite loops

    // Use constant for max attempts
    while (wrongAnswers.size < count && attempts < WRONG_ANSWER_MAX_ATTEMPTS) {
        attempts++;
        // Generate a potential wrong answer different from the correct one
        let wrong = correctAnswer;
        while (wrong === correctAnswer) {
            // Try generating a number within a difficulty-based range around the answer
            const minRange = Math.max(WRONG_ANSWER_MIN_VALUE, correctAnswer - range);
            const maxRange = Math.min(correctAnswer + range, maxVal); // Cap maxRange at maxVal
            wrong = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
        }

        // Add if it's within the valid range (0 to difficulty max) and not already in the set
        if (wrong >= WRONG_ANSWER_MIN_VALUE && wrong <= maxVal) { 
          wrongAnswers.add(wrong);
        }
    }

    // Fallback logic if not enough distinct answers were generated
    if (wrongAnswers.size < count) {
        console.warn(`[MathGameManager] Could only generate ${wrongAnswers.size}/${count} distinct wrong answers for ${correctAnswer} within range/attempts. Using fallback.`);
        // Add simple offsets as fallback, ensuring validity
        let fallbackNum = correctAnswer + 1;
        while(wrongAnswers.size < count) {
            // Ensure fallback is valid (range, different from correct, not already added)
            if (fallbackNum !== correctAnswer && 
                fallbackNum >= WRONG_ANSWER_MIN_VALUE && 
                fallbackNum <= maxVal && // Use difficulty maxVal
                !wrongAnswers.has(fallbackNum)) 
            {
                wrongAnswers.add(fallbackNum);
            }
            fallbackNum++;
            // Safety break for fallback loop
            if (fallbackNum > maxVal + 5) { // Check slightly beyond max value
                 console.error(`[MathGameManager] Fallback failed to generate ${count} wrong answers for ${correctAnswer}.`);
                 break; 
            }
        }
    } 

    console.log(`[MathGameManager] Generated wrong answers for ${correctAnswer}: ${Array.from(wrongAnswers)}`);

    // Ensure we always return exactly the required count, adding random valid numbers if needed (final safety net)
    const finalAnswers = Array.from(wrongAnswers);
    while (finalAnswers.length < count) {
        let safetyNum = Math.floor(Math.random() * (maxVal + 1)); // Generate random number in valid range
        if (safetyNum !== correctAnswer && !finalAnswers.includes(safetyNum)) {
            finalAnswers.push(safetyNum);
        }
        // Add a safety break for this loop too, although it's highly unlikely to be needed
        attempts++;
        if (attempts > WRONG_ANSWER_MAX_ATTEMPTS * 2) {
             console.error(`[MathGameManager] Safety net failed to generate ${count} wrong answers for ${correctAnswer}. Returning what we have.`);
             break;
        }
    }

    return finalAnswers.slice(0, count); // Return exactly the required count
  }

  /**
   * Spawns temporary, non-collidable block entities for visual feedback.
   * @param playerEntity The player entity around which to spawn the effect.
   * @param textureUri The texture for the effect blocks.
   * @param count The number of effect blocks to spawn. // Default used from constant
   * @param durationMs How long the effect blocks should last. // Default used from constant
   */
  private spawnTemporaryEffect(
    playerEntity: PlayerEntity,
    textureUri: string,
    count: number = EFFECT_BLOCK_COUNT,
    durationMs: number = EFFECT_BLOCK_DURATION_MS
  ): void {
    const spawnPosition = playerEntity.position;

    console.log(`[MathGameManager] Spawning temporary effect (${textureUri}) near ${playerEntity.player.username} at ${JSON.stringify(spawnPosition)}`);

    for (let i = 0; i < count; i++) {
      // Use constants for offsets and spread
      const offsetX = (Math.random() - 0.5) * EFFECT_BLOCK_SPREAD_XZ;
      const offsetY = Math.random() * EFFECT_BLOCK_SPREAD_Y + EFFECT_BLOCK_OFFSET_Y;
      const offsetZ = (Math.random() - 0.5) * EFFECT_BLOCK_SPREAD_XZ;

      const effectBlock = new Entity({
        blockTextureUri: textureUri,
        blockHalfExtents: EFFECT_BLOCK_HALF_EXTENTS,
        rigidBodyOptions: {
          type: RigidBodyType.FIXED, // Fixed, cosmetic
          colliders: [{
            shape: ColliderShape.BLOCK,
            halfExtents: EFFECT_BLOCK_HALF_EXTENTS,
            isSensor: true // Non-collidable
          }]
        }
      });

      const blockPos = {
        x: spawnPosition.x + offsetX,
        y: spawnPosition.y + offsetY,
        z: spawnPosition.z + offsetZ
      };

      try {
        effectBlock.spawn(this._world, blockPos);

        // Schedule despawn
        setTimeout(() => {
          if (effectBlock.isSpawned) {
            effectBlock.despawn();
          }
        }, durationMs);

      } catch (error) {
          console.error(`[MathGameManager] Error spawning/despawning temporary effect block:`, error);
      }
    }
  }

  // --- Music Control Methods ---

  /** Starts the background music if it's not already playing. */
  private _playBackgroundMusic(): void {
    if (this._backgroundMusic && !this._isMusicPlaying) {
      try {
        // Remove the setTimeout delay
        // Use the forcePlay argument (true) to ensure it restarts
        this._backgroundMusic.play(this._world, true); 
        this._isMusicPlaying = true;
        console.log('[MathGameManager] Background music started (forced).'); // Updated log
      } catch (error) {
        console.error('[MathGameManager] Error playing background music:', error);
      }
    } else if (this._isMusicPlaying) {
      // console.log('[MathGameManager] Background music already playing.'); // Optional log
    } else {
       console.error('[MathGameManager] Background music object is missing, cannot play.');
    }
  }

  /** Stops the background music if it is currently playing. */
  private _stopBackgroundMusic(): void {
    if (this._backgroundMusic && this._isMusicPlaying) {
      try {
        // Use pause() instead of stop()
        this._backgroundMusic.pause();
        this._isMusicPlaying = false;
        console.log('[MathGameManager] Background music stopped (paused).'); // Updated log message
      } catch (error) {
        console.error('[MathGameManager] Error pausing background music:', error);
      }
    } else if (!this._isMusicPlaying) {
        // console.log('[MathGameManager] Background music already stopped.'); // Optional log
    } else {
       console.error('[MathGameManager] Background music object is missing, cannot pause.');
    }
  }

  /** Checks if any players currently have an active game session. */
  private _isAnyPlayerActive(): boolean {
      for (const state of playerGameStateMap.values()) {
          if (state.gameActive) {
              return true; // Found at least one active player
          }
      }
      return false; // No active players found
  }

  /** Stops the background music ONLY if no players have an active game. */
  private _stopBackgroundMusicIfLastPlayer(): void {
      if (!this._isAnyPlayerActive()) {
          console.log('[MathGameManager] No active players remaining, stopping music.');
          this._stopBackgroundMusic();
      } else {
          // console.log('[MathGameManager] Other players are still active, music continues.'); // Optional log
      }
  }

  /**
   * Creates visual effects for the player during the long fall sequence.
   * Spawns sparkles and particles around the player at intervals.
   * @param player The player to create effects for
   * @param duration How long to keep creating effects (ms)
   */
  private _createFallingEffects(player: Player, duration: number = 3000): void {
    const playerData = playerEntityMap.get(player.username);
    if (!playerData) return;
    
    const entity = playerData.entity;
    const effectInterval = 500; // Spawn effects every 500ms
    const effectCount = Math.floor(duration / effectInterval);
    
    // Use different effect blocks for variety
    const effectTextures = [
        EFFECT_BLOCK_CORRECT_TEXTURE,
        'blocks/diamond-block.png',
        'blocks/gold-block.png',
        TUNNEL_DECOR_TEXTURE_HYTOPIA_LOGO
    ];
    
    // Create a repeating interval to spawn effects while falling
    let counter = 0;
    const effectTimer = setInterval(() => {
        // Check if we should stop creating effects
        if (counter >= effectCount) {
            clearInterval(effectTimer);
            return;
        }
        
        // Alternate between different effect textures
        const textureIndex = counter % effectTextures.length;
        const texture = effectTextures[textureIndex];
        
        // Create more particles for a more dramatic effect
        this.spawnTemporaryEffect(entity, texture, 5, 2000);
        
        counter++;
    }, effectInterval);
}
}

// --- Number Tunnel System ---
class NumberTunnelSystem {
  private _world: World;
  private _tunnelEntities: Entity[] = [];

  constructor(world: World) {
    this._world = world;
  }

  /**
   * Creates a visually varied tunnel using numbered blocks.
   * @param radius Radius of the tunnel.
   * @param height Total height/length of the tunnel.
   * @param segments Number of vertical segments (rings) to build.
   * @param blocksPerRing Number of blocks in each ring.
   */
  public createTunnel(
    radius: number = TUNNEL_RADIUS,
    height: number = TUNNEL_HEIGHT,
    segments: number = 30, // Further reduced for memory
    blocksPerRing: number = 12 // Reduced for memory
  ): void {
    console.log(`[NumberTunnelSystem] Creating tunnel with ${segments * blocksPerRing} numbered blocks...`);
    const segmentHeight = height / segments;

    for (let h = 0; h < segments; h++) {
      // Calculate the Y position for this ring (going downwards)
      // Start slightly below y=0 and go down to -height
      const y = -(h * segmentHeight) - (segmentHeight / 2); 

      for (let i = 0; i < blocksPerRing; i++) {
        const angle = (i / blocksPerRing) * Math.PI * 2;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;

        // Randomly select a number texture (0-15)
        const randomNumber = Math.floor(Math.random() * (WRONG_ANSWER_MAX_VALUE + 1));
        const texturePath = `${ANSWER_BLOCK_TEXTURE_PATH}${randomNumber}.png`;

        // Create the tunnel wall block
        const block = new Entity({
          blockTextureUri: texturePath,
          blockHalfExtents: TUNNEL_BLOCK_HALF_EXTENTS,
          rigidBodyOptions: {
            type: RigidBodyType.FIXED, // Changed from KINEMATIC_VELOCITY
            // angularVelocity removed as it doesn't apply to FIXED
            colliders: [{
              shape: ColliderShape.BLOCK,
              halfExtents: TUNNEL_BLOCK_HALF_EXTENTS // Keep collider, but it won't be solid
            }]
          }
        });

        block.spawn(this._world, { x, y, z });
        // Calculate rotation to point the block's bottom face (-Y) inwards towards the center axis
        const sinThetaOver2 = 0.70710678; // sin(90 / 2)
        const cosThetaOver2 = 0.70710678; // cos(90 / 2)
        const rotation = { 
          x: Math.cos(angle) * sinThetaOver2,
          y: 0, 
          z: -Math.sin(angle) * sinThetaOver2,
          w: cosThetaOver2
        };
        // Apply the calculated rotation
        block.setRotation(rotation);
        this._tunnelEntities.push(block);
      }
    }
    console.log(`[NumberTunnelSystem] Finished creating tunnel walls.`);
    
    // Add decorative elements inside the tunnel
    this._addTunnelDecorations(radius, height, segments);
  }

  /**
   * Adds decorative, non-colliding light blocks inside the tunnel walls.
   */
  private _addTunnelDecorations(radius: number, height: number, segments: number): void {
    const lightsPerRing = TUNNEL_DECOR_LIGHTS_PER_RING;
    const segmentStep = TUNNEL_DECOR_SEGMENT_STEP;
    const radiusOffset = TUNNEL_DECOR_RADIUS_OFFSET;
    const segmentHeight = height / segments;
    console.log(`[NumberTunnelSystem] Adding decorations...`);

    for (let h = 0; h < segments; h += segmentStep) {
        const y = -(h * segmentHeight) - (segmentHeight / 2);

        for (let i = 0; i < lightsPerRing; i++) {
            const angle = (i / lightsPerRing + h * 0.1) * Math.PI * 2;
            const x = Math.sin(angle) * (radius - radiusOffset);
            const z = Math.cos(angle) * (radius - radiusOffset);

            const decorBlock = new Entity({
                blockTextureUri: TUNNEL_DECOR_TEXTURE_HYTOPIA_LOGO, // Use the Hytopia logo texture
                blockHalfExtents: TUNNEL_DECOR_HALF_EXTENTS,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_VELOCITY,
                    angularVelocity: TUNNEL_DECOR_ANGULAR_VELOCITY,
                    colliders: [{
                        shape: ColliderShape.BLOCK,
                        halfExtents: TUNNEL_DECOR_HALF_EXTENTS,
                        isSensor: true
                    }]
                }
            });

            decorBlock.spawn(this._world, { x, y, z });
            this._tunnelEntities.push(decorBlock);
        }
    }
    console.log(`[NumberTunnelSystem] Finished adding decorations.`);
  }

  /**
   * Cleans up all tunnel entities.
   */
  public cleanup(): void {
    console.log(`[NumberTunnelSystem] Cleaning up ${this._tunnelEntities.length} tunnel blocks.`);
    this._tunnelEntities.forEach(entity => {
      if (entity.isSpawned) {
        entity.despawn();
      }
    });
    this._tunnelEntities = [];
  }
}
// --- End Number Tunnel System ---

// --- Cloud System ---
class CloudSystem {
  private _world: World;
  private _cloudEntities: Entity[] = [];

  constructor(world: World) {
    this._world = world;
  }

  /**
   * Creates scattered cloud formations around the play area.
   * @param count Number of cloud formations to generate.
   * @param center The center point around which clouds generate (usually {x:0, z:0}).
   * @param radiusMin Minimum distance from the center.
   * @param radiusMax Maximum distance from the center.
   * @param heightMin Minimum height for clouds.
   * @param heightMax Maximum height for clouds.
   * @param blocksPerCloud Approximate number of blocks per cloud formation.
   */
  public createClouds(
    count: number = CLOUD_COUNT,
    center: Vector3Like = CLOUD_CENTER,
    radiusMin: number = CLOUD_RADIUS_MIN, 
    radiusMax: number = CLOUD_RADIUS_MAX,
    heightMin: number = CLOUD_HEIGHT_MIN,
    heightMax: number = CLOUD_HEIGHT_MAX,
    blocksPerCloud: number = CLOUD_BLOCKS_PER_FORMATION
  ): void {
    console.log(`[CloudSystem] Creating ${count} cloud formations...`);

    for (let i = 0; i < count; i++) {
      // Determine a random position for the center of this cloud formation
      const angle = Math.random() * Math.PI * 2;
      const distance = radiusMin + Math.random() * (radiusMax - radiusMin);
      const cloudCenterX = center.x + Math.sin(angle) * distance;
      const cloudCenterZ = center.z + Math.cos(angle) * distance;
      const cloudCenterY = heightMin + Math.random() * (heightMax - heightMin);

      // Create the blocks for this cloud
      for (let j = 0; j < blocksPerCloud; j++) {
        // Offset each block slightly using constants for spread
        const offsetX = (Math.random() - 0.5) * CLOUD_BLOCK_SPREAD_XZ;
        const offsetY = (Math.random() - 0.5) * CLOUD_BLOCK_SPREAD_Y;
        const offsetZ = (Math.random() - 0.5) * CLOUD_BLOCK_SPREAD_XZ;

        const block = new Entity({
          blockTextureUri: CLOUD_BLOCK_TEXTURE,
          blockHalfExtents: CLOUD_BLOCK_HALF_EXTENTS,
          rigidBodyOptions: {
            type: RigidBodyType.FIXED, 
            colliders: [{
              shape: ColliderShape.BLOCK,
              halfExtents: CLOUD_BLOCK_HALF_EXTENTS,
              isSensor: true
            }]
          }
        });

        const blockPos = {
          x: cloudCenterX + offsetX,
          y: cloudCenterY + offsetY,
          z: cloudCenterZ + offsetZ
        };

        block.spawn(this._world, blockPos);
        this._cloudEntities.push(block);
      }
    }
    console.log(`[CloudSystem] Created a total of ${this._cloudEntities.length} cloud blocks.`);
  }

  /**
   * Cleans up all cloud entities.
   */
  public cleanup(): void {
    console.log(`[CloudSystem] Cleaning up ${this._cloudEntities.length} cloud blocks.`);
    this._cloudEntities.forEach(entity => {
      if (entity.isSpawned) {
        entity.despawn();
      }
    });
    this._cloudEntities = [];
  }
}
// --- End Cloud System ---

// --- Initialization Function ---
/**
 * Initializes all the core game systems.
 * @param world The game world instance.
 */
function initializeGameSystems(world: World): void {
  // Create background music object BUT DON'T PLAY IT YET
  console.log('[Server] Creating background music object...');
  const backgroundMusic = new Audio({
    uri: AUDIO_MUSIC_BACKGROUND, 
    loop: true,
    volume: AUDIO_MUSIC_VOLUME 
  });
  console.log('[Server] Background music object created.');

  // Initialize Phase 3 systems
  console.log('[Server] Initializing Phase 3: Multiplayer & Social Features...');
  
  // Initialize global leaderboard system
  GlobalLeaderboardSystem.instance.initialize(world);
  
  // Initialize competitive race manager
  CompetitiveRaceManager.instance.initialize(world);
  
  // Initialize team challenge manager
  TeamChallengeManager.instance.initialize(world);
  
  // Initialize social features system
  SocialFeaturesSystem.instance.initialize(world);
  
  console.log('[Server] Phase 3 systems initialized successfully.');

  // Initialize Phase 4 systems
  console.log('[Server] Initializing Phase 4: Platform Optimization...');
  
  // Initialize performance monitoring system
  PerformanceMonitor.instance.initialize(world);
  
  // Initialize advanced mobile controls
  AdvancedMobileControls.instance.initialize(world);
  
  // Initialize accessibility features
  AccessibilityFeatures.instance.initialize(world);
  
  console.log('[Server] Phase 4 systems initialized successfully.');

  // Pass the music object to the game manager
  // This implicitly sets up player join/leave listeners and UI interaction
  new MathGameManager(world, backgroundMusic); // Pass music object

  // Create cosmetic clouds using constants defined above
  const cloudSystem = new CloudSystem(world);
  cloudSystem.createClouds(
      CLOUD_COUNT,
      CLOUD_CENTER,
      CLOUD_RADIUS_MIN,
      CLOUD_RADIUS_MAX,
      CLOUD_HEIGHT_MIN,
      CLOUD_HEIGHT_MAX,
      CLOUD_BLOCKS_PER_FORMATION
  ); 

  // Create the numbered block tunnel using constants defined above
  const numberTunnelSystem = new NumberTunnelSystem(world);
  numberTunnelSystem.createTunnel(
      TUNNEL_RADIUS,
      TUNNEL_HEIGHT,
      30, // Reduced for memory optimization
      12  // Reduced for memory optimization
  );
}

// --- Server Start ---
startServer(world => {
  console.log('[Server] Starting...');
  // Call the initialization function
  initializeGameSystems(world);
  console.log('[Server] Initialization complete. Waiting for players...');
});