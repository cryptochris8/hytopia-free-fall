import { startServer, World, Entity, PlayerEvent, PlayerEntity, Audio, RigidBodyType, ColliderShape, BaseEntityController, EntityEvent, PlayerUIEvent, PlayerCameraMode, CollisionGroup, Player } from 'hytopia';
import type { PlayerInput } from 'hytopia';
import type { PlayerCameraOrientation } from 'hytopia';
import type { Vector3Like } from 'hytopia';
import type { Vector3 } from 'hytopia';
import type { CollisionCallback } from 'hytopia';
import type { BlockType } from 'hytopia';

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

// Import the existing game classes and constants from index.ts
// Since we're not modifying the original game, we'll reuse its core functionality

// Extend the PlayerEvent module to include our custom events
declare module 'hytopia' {
  interface EventPayloads {
    'correctAnswer': { player: Player };
    'wrongAnswer': { player: Player };
  }
}

// Player data interface
interface PlayerData {
  entity: PlayerEntity;
  controller: FallingPlayerController;
  isMobile: boolean; // Add flag to track device type
}

// Map to store player entities and their controllers
const playerEntityMap = new Map<string, PlayerData>();

// Player game state interface
interface PlayerGameState {
  score: number;
  questionsPresented: number;
  gameActive: boolean;
  currentAnswer: number;
}

// Map to store player game states
const playerGameStateMap = new Map<string, PlayerGameState>();

// Game constants
const MAX_QUESTIONS = 10;
const GAME_RESET_DELAY_MS = 500;
const BACKGROUND_MUSIC_DELAY_MS = 15000;

// Player settings
const PLAYER_MOVE_SPEED = 5;
const PLAYER_MODEL_URI = 'models/players/player.gltf';
const PLAYER_MODEL_SCALE = 0.5;
const PLAYER_INITIAL_ANIMATION = 'idle';
const PLAYER_WALK_ANIMATION = 'walk';
const PLAYER_GRAVITY_SCALE = 0.1;
const PLAYER_LINEAR_DAMPING = 0.5;
const PLAYER_COLLIDER_HALF_HEIGHT = 0.5;
const PLAYER_COLLIDER_RADIUS = 0.3;
const PLAYER_SPAWN_POSITION: Vector3Like = { x: 0, y: 25, z: 0 };
const PLAYER_RESET_POSITION: Vector3Like = { x: 0, y: 0, z: 0 };
const PLAYER_CAMERA_OFFSET: Vector3Like = { x: 0, y: 1.5, z: 0 };
const PLAYER_CAMERA_FORWARD_OFFSET = 1.0;
const PLAYER_FACING_DOWN_ROTATION = { x: -0.7071068, y: 0, z: 0, w: 0.7071068 };

// Answer block settings
const ANSWER_BLOCK_TEXTURE_PATH = 'blocks/Free-fall/';
const ANSWER_BLOCK_HALF_EXTENTS: Vector3Like = { x: 0.5, y: 0.5, z: 0.5 };
const ANSWER_BLOCK_SPACING = 3;
const ANSWER_BLOCK_Y_POSITION = -80;
const ANSWER_BLOCK_BREAK_FRAGMENTS = 8;
const ANSWER_BLOCK_BREAK_DURATION_MS = 1500;
const ANSWER_BLOCK_BREAK_VELOCITY = 3.0;
const ANSWER_BLOCK_BREAK_ANGULAR_SPEED = 2.0;
const ANSWER_BLOCK_BREAK_FRAGMENT_HALF_EXTENTS: Vector3Like = { x: 0.15, y: 0.15, z: 0.15 };
const ANSWER_BLOCK_BREAK_FRAGMENT_GRAVITY = 0.8;
const FALL_THRESHOLD_Y = ANSWER_BLOCK_Y_POSITION - 5;
const FALL_RESET_Y = ANSWER_BLOCK_Y_POSITION - 20; // Safety reset point if player falls too far

// Math problem settings
const MATH_PROBLEM_MAX_VALUE = 15;
const MATH_PROBLEM_MAX_VALUE_ADD = 15;
const MATH_PROBLEM_MAX_VALUE_SUB = 15;
const MATH_PROBLEM_MAX_VALUE_MUL = 15;
const MATH_PROBLEM_MAX_VALUE_DIV_ANSWER = 15;
const MATH_PROBLEM_MAX_VALUE_DIV_DIVISOR = 5;
const MATH_PROBLEM_MAX_VALUE_DIV_NUM1 = 30;
const MATH_PROBLEM_OPERATIONS = ['+', '-', '*', '/'];
const WRONG_ANSWER_COUNT = 3;
const WRONG_ANSWER_RANGE = 10;
const WRONG_ANSWER_MAX_ATTEMPTS = 100;
const WRONG_ANSWER_MIN_VALUE = 0;
const WRONG_ANSWER_MAX_VALUE = 15;

// Audio paths
const AUDIO_MUSIC_BACKGROUND = 'audio/music/Free-fall.mp3';
const AUDIO_SFX_CORRECT = 'audio/sfx/correct.mp3';
const AUDIO_SFX_WRONG = 'audio/sfx/wrong.mp3';
const AUDIO_SFX_VOLUME = 1.0;
const AUDIO_SFX_REFERENCE_DISTANCE = 15;
const AUDIO_MUSIC_VOLUME = 0.7;

// UI paths
const UI_DESKTOP_PATH = 'ui/index.html';
const UI_MOBILE_PATH = 'ui/mobile.html';
const UI_DETECTOR_PATH = 'ui/detector.html';

// UI detection timeout
const DEVICE_DETECTION_TIMEOUT_MS = 2000;

// Effect settings
const EFFECT_BLOCK_CORRECT_TEXTURE = 'blocks/emerald-block.png';
const EFFECT_BLOCK_WRONG_TEXTURE = 'blocks/fire/fire_01.png';
const EFFECT_BLOCK_COUNT = 3;
const EFFECT_BLOCK_DURATION_MS = 500;
const EFFECT_BLOCK_HALF_EXTENTS: Vector3Like = { x: 0.15, y: 0.15, z: 0.15 };
const EFFECT_BLOCK_SPREAD_XZ = 1.5;
const EFFECT_BLOCK_SPREAD_Y = 0.5;
const EFFECT_BLOCK_OFFSET_Y = 0.2;

/**
 * Player controller for the falling game.
 * Handles player input and movement.
 */
class FallingPlayerController extends BaseEntityController {
  private moveSpeed = PLAYER_MOVE_SPEED;
  private isMoving = false;
  private hasFallen = false;
  private _world: World;

  constructor(world: World) {
    super();
    this._world = world;
  }

  public tickWithPlayerInput(
    entity: PlayerEntity,
    input: PlayerInput,
    cameraOrientation: PlayerCameraOrientation,
    deltaTimeMs: number
  ): void {
    // Lock camera orientation to look straight down
    cameraOrientation.pitch = -Math.PI / 2;
    cameraOrientation.yaw = 0;

    // Set player rotation
    try {
      entity.setRotation(PLAYER_FACING_DOWN_ROTATION);
    } catch (error) {
      console.error(`[FallingPlayerController] Error setting rotation for entity ${entity.id}:`, error);
    }

    // Get current position
    const currentPos = entity.position;

    // Check for fall detection
    if (currentPos.y < FALL_THRESHOLD_Y && !this.hasFallen) {
      const player = entity.player;
      const playerState = playerGameStateMap.get(player.username);

      if (playerState && playerState.gameActive) {
        console.log(`[FallingPlayerController] Player ${player.username} fell below threshold Y=${FALL_THRESHOLD_Y}. Emitting wrongAnswer.`);
        this._world.emit('wrongAnswer', { player: player });
        this.hasFallen = true;
      }
    }
    
    // Safety check: if player falls too far, force a reset
    if (currentPos.y < FALL_RESET_Y && this.hasFallen) {
      const player = entity.player;
      const playerState = playerGameStateMap.get(player.username);
      
      if (playerState && playerState.gameActive) {
        console.log(`[FallingPlayerController] Player ${player.username} fell too far (Y=${currentPos.y}), forcing position reset.`);
        // Immediately reset position to prevent infinite falling
        try {
          entity.setPosition(PLAYER_SPAWN_POSITION);
          this.hasFallen = false;
        } catch (error) {
          console.error(`[FallingPlayerController] Error resetting player position:`, error);
        }
      }
    }

    // Handle movement
    const moveAmount = (this.moveSpeed * deltaTimeMs) / 1000;
    let dx = 0;
    let dz = 0;
    const wantsToMove = input.w || input.s || input.a || input.d;

    if (wantsToMove) {
      if (input.w) dz -= moveAmount;
      if (input.s) dz += moveAmount;
      if (input.a) dx -= moveAmount;
      if (input.d) dx += moveAmount;

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

    // Handle animations
    try {
      if (wantsToMove && !this.isMoving) {
        this.isMoving = true;
        entity.stopModelAnimations([PLAYER_INITIAL_ANIMATION]);
        entity.startModelLoopedAnimations([PLAYER_WALK_ANIMATION]);
      } else if (!wantsToMove && this.isMoving) {
        this.isMoving = false;
        entity.stopModelAnimations([PLAYER_WALK_ANIMATION]);
        entity.startModelLoopedAnimations([PLAYER_INITIAL_ANIMATION]);
      }
    } catch (error) {
      console.error(`[FallingPlayerController] Error managing animations for entity ${entity.id}:`, error);
    }
  }

  // Reset fall detection
  public resetFallState(): void {
    this.hasFallen = false;
  }
}

/**
 * Manager for the answer blocks that players interact with.
 */
class AnswerBlocksManager {
  private _blocks: Entity[] = [];
  private _world: World;

  constructor(world: World) {
    this._world = world;
  }

  // Clear existing blocks
  public clearAnswerBlocks(): void {
    console.log(`[AnswerBlocksManager] Clearing ${this._blocks.length} existing blocks.`);
    this._blocks.forEach(block => {
      if (block.isSpawned) {
        console.log(`[AnswerBlocksManager] Despawning block ID: ${block.id}`);
        block.despawn();
      }
    });
    this._blocks = [];
  }

  // Generate answer blocks with the correct answer and wrong options
  public generateAnswerBlocks(correctAnswer: number, wrongAnswers: number[]): void {
    this.clearAnswerBlocks();

    const answers = [correctAnswer, ...wrongAnswers];
    const positions = this._generateBlockPositions(answers.length);

    // Shuffle positions
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Create blocks
    answers.forEach((answerValue, index) => {
      const texturePath = `${ANSWER_BLOCK_TEXTURE_PATH}${answerValue}.png`;
      const blockPosition = positions[index];

      const block = new Entity({
        blockTextureUri: texturePath,
        blockHalfExtents: ANSWER_BLOCK_HALF_EXTENTS,
        rigidBodyOptions: {
          type: RigidBodyType.FIXED,
          colliders: [{
            shape: ColliderShape.BLOCK,
            halfExtents: ANSWER_BLOCK_HALF_EXTENTS,
            onCollision: (otherEntity: Entity | BlockType, started: boolean) => {
              if (started && otherEntity instanceof PlayerEntity) {
                const player = otherEntity.player;
                const playerState = playerGameStateMap.get(player.username);

                if (!playerState || !playerState.gameActive) {
                  return;
                }

                if (answerValue === playerState.currentAnswer) {
                  console.log(`[AnswerBlocksManager] Correct answer (${answerValue}) hit by ${player.username}`);
                  this._world.emit('correctAnswer', { player: player });
                } else {
                  console.log(`[AnswerBlocksManager] Wrong answer (${answerValue}) hit by ${player.username}. Correct was: ${playerState.currentAnswer}`);
                  this._world.emit('wrongAnswer', { player: player });
                }

                if (block.isSpawned) {
                  const currentPosition = block.position as Vector3;
                  console.log(`[AnswerBlocksManager] Spawning break effect for block ID: ${block.id} at ${JSON.stringify(currentPosition)}`);
                  this._spawnBreakEffect(
                    currentPosition,
                    texturePath,
                    ANSWER_BLOCK_BREAK_FRAGMENTS,
                    ANSWER_BLOCK_BREAK_DURATION_MS
                  );

                  console.log(`[AnswerBlocksManager] Despawning block ID: ${block.id} after collision with ${player.username}.`);
                  block.despawn();
                }
              }
            }
          }]
        }
      });

      console.log(`[AnswerBlocksManager] Attempting to spawn block for answer ${answerValue} at position ${JSON.stringify(blockPosition)}, Texture: ${texturePath}`);
      block.spawn(this._world, blockPosition);
      block.setRotation({ x: 0, y: 1, z: 0, w: 0 });
      this._blocks.push(block);
    });
    console.log(`[AnswerBlocksManager] Spawned ${this._blocks.length} new blocks.`);
  }

  // Generate positions for the answer blocks
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

  // Create break effect for blocks
  private _spawnBreakEffect(
    position: Vector3,
    textureUri: string,
    fragmentCount: number = ANSWER_BLOCK_BREAK_FRAGMENTS,
    durationMs: number = ANSWER_BLOCK_BREAK_DURATION_MS
  ): void {
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

/**
 * Main game manager class that handles game state and events.
 */
class MathGameManager {
  private _answerBlocksManager: AnswerBlocksManager;
  private _backgroundMusic: Audio | null = null;
  private _isMusicPlaying: boolean = false;
  private _musicStartTimer: NodeJS.Timeout | null = null;

  constructor(private _world: World, backgroundMusic: Audio) {
    this._answerBlocksManager = new AnswerBlocksManager(_world);
    this._backgroundMusic = backgroundMusic;
    
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

    // Handle player joining
    _world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
      this._handlePlayerJoin(player);
    });

    // Handle player leaving
    _world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
      this._handlePlayerLeave(player);
    });

    // Handle correct answers
    _world.on('correctAnswer', ({ player }) => {
      this._handleCorrectAnswer(player);
    });

    // Handle wrong answers
    _world.on('wrongAnswer', ({ player }) => {
      this._handleWrongAnswer(player);
    });
  }

  /**
   * Handle player joining the game.
   */
  private _handlePlayerJoin(player: Player): void {
    console.log(`[MathGameManager] Player ${player.username} joined, detecting device type...`);
    
    // First load the detector UI to determine if the device is mobile
    player.ui.load(UI_DETECTOR_PATH);
    
    // Set up a detection listener
    const detectionHandler = ({ playerUI, data }: { playerUI: any; data: any }) => {
      if (data && data.type === 'device-detection') {
        // Remove the detector listener since we only need this once
        player.ui.off(PlayerUIEvent.DATA, detectionHandler);
        
        // Get the detected device type
        const isMobile = data.isMobile === true;
        console.log(`[MathGameManager] Device detection for ${player.username}: ${isMobile ? 'Mobile' : 'Desktop'}`);
        
        // Now proceed with player setup
        this._setupPlayer(player, isMobile);
      }
    };
    
    // Add the detector listener
    player.ui.on(PlayerUIEvent.DATA, detectionHandler);
    
    // Set a timeout in case detection fails
    setTimeout(() => {
      // If the player entity hasn't been set up yet (which means detection probably failed)
      if (!playerEntityMap.has(player.username)) {
        console.log(`[MathGameManager] Device detection timed out for ${player.username}, defaulting to desktop UI.`);
        player.ui.off(PlayerUIEvent.DATA, detectionHandler);
        
        // Default to desktop
        this._setupPlayer(player, false);
      }
    }, DEVICE_DETECTION_TIMEOUT_MS);
  }
  
  /**
   * Set up a player after device detection.
   */
  private _setupPlayer(player: Player, isMobile: boolean): void {
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

    // Set up camera
    player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
    player.camera.setOffset(PLAYER_CAMERA_OFFSET);
    player.camera.setForwardOffset(PLAYER_CAMERA_FORWARD_OFFSET);
    
    // Spawn player
    playerEntity.spawn(this._world, PLAYER_SPAWN_POSITION);
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

    // Store references for later use
    const controllerInstance = playerEntity.controller as FallingPlayerController;
    playerEntityMap.set(player.username, { 
      entity: playerEntity, 
      controller: controllerInstance,
      isMobile // Store the device type
    });

    // Initialize game state
    playerGameStateMap.set(player.username, {
      score: 0,
      questionsPresented: 0,
      gameActive: false,
      currentAnswer: 0
    });
    console.log(`[MathGameManager] Initialized game state for ${player.username}`);
    
    // Initialize Phase 2 systems for player
    CurriculumSystem.getInstance().initializePlayerProgress(player.id);
    LearningAnalyticsDashboard.getInstance().startSession(player.id);
    AchievementSystem.getInstance().initializePlayerProgress(player.id);
    AdaptiveDifficultySystem.getInstance().initializePlayerParameters(player.id);
    ProgressVisualizationSystem.getInstance().initializePlayerVisualization(player.id);
    console.log(`[MathGameManager] Initialized Phase 2 systems for ${player.username}`);

    // Load the appropriate UI based on device type
    const uiPath = isMobile ? UI_MOBILE_PATH : UI_DESKTOP_PATH;
    player.ui.load(uiPath);
    console.log(`[MathGameManager] Loaded ${isMobile ? 'mobile' : 'desktop'} UI for ${player.username}`);

    // Set up UI event listeners
    this._setupUIListeners(player);
  }

  /**
   * Set up UI event listeners for player interactions.
   */
  private _setupUIListeners(player: Player): void {
    player.ui.on(PlayerUIEvent.DATA, ({ playerUI, data }) => {
      console.log(`[MathGameManager] Received UI data from ${player.username}:`, data);
      const playerState = playerGameStateMap.get(player.username);
      const playerData = playerEntityMap.get(player.username);

      if (!playerState || !playerData) {
        console.error(`[MathGameManager] Received UI data for unknown player state or data: ${player.username}`);
        return;
      }

      if (data.type === 'audio-activated') {
        console.log(`[MathGameManager] Audio activated signal received from ${player.username}`);
        // This signal indicates the client's audio context is active
      } else if (data.type === 'start-game') {
        console.log(`[MathGameManager] Start game requested by ${player.username}`);
        playerState.score = 0;
        playerState.questionsPresented = 0;
        playerState.gameActive = true;
        playerGameStateMap.set(player.username, playerState);

        // Reset position and fall state
        playerData.entity.setPosition(PLAYER_SPAWN_POSITION);
        playerData.controller.resetFallState();

        this.generateNewProblem(player);
        
        // Start background music with delay for mobile compatibility
        this._playBackgroundMusic();
      } else if (data.type === 'restart-game') {
        console.log(`[MathGameManager] Restart game requested by ${player.username}`);
        playerState.score = 0;
        playerState.questionsPresented = 0;
        playerState.gameActive = false;
        playerGameStateMap.set(player.username, playerState);
        this._answerBlocksManager.clearAnswerBlocks();
        this._stopBackgroundMusicIfLastPlayer();
      }
    });
  }

  /**
   * Handle player leaving the game.
   */
  private _handlePlayerLeave(player: Player): void {
    console.log(`[MathGameManager] Player ${player.username} left.`);
    
    // Clean up player entity
    const playerData = playerEntityMap.get(player.username);
    if (playerData) {
      playerData.entity.despawn();
      playerEntityMap.delete(player.username);
    } else {
      console.warn(`[MathGameManager] Could not find player data for leaving player ${player.username}`);
    }
    
    // Clean up player state
    playerGameStateMap.delete(player.username);
    console.log(`[MathGameManager] Cleaned up state for ${player.username}.`);
    
    // Clean up Phase 2 systems
    LearningAnalyticsDashboard.getInstance().endSession(player.id);
    ProgressVisualizationSystem.getInstance().cleanupPlayerVisualization(player.id);
    console.log(`[MathGameManager] Cleaned up Phase 2 systems for ${player.username}.`);
    
    // Handle background music
    if (playerEntityMap.size === 0) {
      console.log(`[MathGameManager] Last player left, clearing answer blocks.`);
      this._answerBlocksManager.clearAnswerBlocks();
      this._stopBackgroundMusic();
    } else {
      this._stopBackgroundMusicIfLastPlayer();
    }
  }

  /**
   * Handle correct answer from a player.
   */
  private _handleCorrectAnswer(player: Player): void {
    const playerData = playerEntityMap.get(player.username);
    const playerState = playerGameStateMap.get(player.username);

    if (!playerData || !playerState || !playerState.gameActive) {
      console.log(`[MathGameManager] Correct answer event ignored for ${player.username} (inactive/missing state).`);
      return;
    }
    const playerEntity = playerData.entity;
    const controller = playerData.controller;

    console.log(`[MathGameManager] Correct answer processed for ${player.username}.`);

    // Update score
    playerState.score++;
    playerState.questionsPresented++;
    playerGameStateMap.set(player.username, playerState);

    // Play correct sound
    try {
      const correctSfx = new Audio({
        uri: AUDIO_SFX_CORRECT,
        loop: false,
        volume: AUDIO_SFX_VOLUME,
        attachedToEntity: playerEntity,
        referenceDistance: AUDIO_SFX_REFERENCE_DISTANCE
      });
      correctSfx.play(this._world);
    } catch (error) {
      console.error(`[MathGameManager] Error playing ${AUDIO_SFX_CORRECT} for ${player.username}:`, error);
    }

    // Spawn effect
    this.spawnTemporaryEffect(playerEntity, EFFECT_BLOCK_CORRECT_TEXTURE);

    // Handle game flow with delay
    setTimeout(() => {
      if (playerState.questionsPresented >= MAX_QUESTIONS) {
        console.log(`[MathGameManager] Game ended for ${player.username}. Final score: ${playerState.score}/${MAX_QUESTIONS}`);
        
        const finalScore = playerState.score;
        playerState.gameActive = false;
        this._stopBackgroundMusicIfLastPlayer();
        
        playerState.score = 0;
        playerState.questionsPresented = 0;
        playerGameStateMap.set(player.username, playerState);

        // Send game over message
        player.ui.sendData({
          type: 'game-over',
          score: finalScore,
          maxQuestions: MAX_QUESTIONS
        });

        this._answerBlocksManager.clearAnswerBlocks();
      } else {
        // Reset for next question - spawn player back at top
        playerEntity.setPosition(PLAYER_SPAWN_POSITION);
        controller.resetFallState();
        this.generateNewProblem(player);
      }
    }, GAME_RESET_DELAY_MS);
  }

  /**
   * Handle wrong answer from a player.
   */
  private _handleWrongAnswer(player: Player): void {
    const playerData = playerEntityMap.get(player.username);
    const playerState = playerGameStateMap.get(player.username);

    if (!playerData || !playerState || !playerState.gameActive) {
      console.log(`[MathGameManager] Wrong answer event ignored for ${player.username} (inactive/missing state).`);
      return;
    }
    const playerEntity = playerData.entity;
    const controller = playerData.controller;

    console.log(`[MathGameManager] Wrong answer processed for ${player.username}. Questions presented: ${playerState.questionsPresented}/${MAX_QUESTIONS}`);

    // Update question count but not score
    playerState.questionsPresented++;
    playerGameStateMap.set(player.username, playerState);

    // Play wrong sound
    try {
      const wrongSfx = new Audio({
        uri: AUDIO_SFX_WRONG,
        loop: false,
        volume: AUDIO_SFX_VOLUME,
        attachedToEntity: playerEntity,
        referenceDistance: AUDIO_SFX_REFERENCE_DISTANCE
      });
      wrongSfx.play(this._world);
    } catch (error) {
      console.error(`[MathGameManager] Error playing ${AUDIO_SFX_WRONG} for ${player.username}:`, error);
    }

    // Spawn effect
    this.spawnTemporaryEffect(playerEntity, EFFECT_BLOCK_WRONG_TEXTURE);

    // Handle game flow with delay
    setTimeout(() => {
      if (playerState.questionsPresented >= MAX_QUESTIONS) {
        console.log(`[MathGameManager] Game ended for ${player.username} after wrong answer. Final score: ${playerState.score}/${MAX_QUESTIONS}`);

        const finalScore = playerState.score;
        playerState.gameActive = false;
        this._stopBackgroundMusicIfLastPlayer();
        
        playerState.score = 0;
        playerState.questionsPresented = 0;
        playerGameStateMap.set(player.username, playerState);

        // Send game over message
        player.ui.sendData({
          type: 'game-over',
          score: finalScore,
          maxQuestions: MAX_QUESTIONS
        });

        this._answerBlocksManager.clearAnswerBlocks();
      } else {
        // Reset for next question - spawn player back at top
        playerEntity.setPosition(PLAYER_SPAWN_POSITION);
        controller.resetFallState();
        this.generateNewProblem(player);
      }
    }, GAME_RESET_DELAY_MS);
  }

  /**
   * Generate a new math problem for a player.
   */
  public generateNewProblem(player: Player): void {
    const playerState = playerGameStateMap.get(player.username);
    if (!playerState || !playerState.gameActive) {
      console.log(`[MathGameManager] generateNewProblem called for inactive player ${player.username}, ignoring.`);
      return;
    }

    // Generate problem
    const operation = MATH_PROBLEM_OPERATIONS[Math.floor(Math.random() * MATH_PROBLEM_OPERATIONS.length)];
    let num1: number = 0, num2: number = 0, answer: number = 0;
    let isValid = false;

    while (!isValid) {
      switch (operation) {
        case '+':
          num1 = Math.floor(Math.random() * (MATH_PROBLEM_MAX_VALUE_ADD + 1));
          num2 = Math.floor(Math.random() * (MATH_PROBLEM_MAX_VALUE_ADD - num1 + 1));
          answer = num1 + num2;
          isValid = true;
          break;
        case '-':
          num1 = Math.floor(Math.random() * (MATH_PROBLEM_MAX_VALUE_SUB + 1));
          num2 = Math.floor(Math.random() * (num1 + 1));
          answer = num1 - num2;
          isValid = true;
          break;
        case '*':
          num1 = Math.floor(Math.random() * (MATH_PROBLEM_MAX_VALUE_MUL + 1));
          if (num1 === 0) {
            num2 = Math.floor(Math.random() * (MATH_PROBLEM_MAX_VALUE_MUL + 1));
          } else {
            const maxNum2 = Math.floor(MATH_PROBLEM_MAX_VALUE_MUL / num1);
            num2 = Math.floor(Math.random() * (maxNum2 + 1));
          }
          answer = num1 * num2;
          isValid = true;
          break;
        case '/':
          answer = Math.floor(Math.random() * (MATH_PROBLEM_MAX_VALUE_DIV_ANSWER + 1));
          num2 = Math.floor(Math.random() * MATH_PROBLEM_MAX_VALUE_DIV_DIVISOR) + 1;
          num1 = answer * num2;
          if (num1 <= MATH_PROBLEM_MAX_VALUE_DIV_NUM1) {
            isValid = true;
          }
          break;
      }
    }

    // Store the correct answer in player's state
    playerState.currentAnswer = answer;
    playerGameStateMap.set(player.username, playerState);

    // Generate wrong answers
    const wrongAnswers = this._generateWrongAnswers(answer, WRONG_ANSWER_COUNT);

    // Create answer blocks
    this._answerBlocksManager.generateAnswerBlocks(answer, wrongAnswers);

    // Send problem to UI
    player.ui.sendData({
      type: 'problem',
      num1,
      num2,
      operation
    });

    console.log(`[MathGameManager] Generated new problem for ${player.username}: ${num1} ${operation} ${num2} = ${answer}.`);
  }

  /**
   * Generate wrong answers for a math problem.
   */
  private _generateWrongAnswers(correctAnswer: number, count: number = WRONG_ANSWER_COUNT): number[] {
    const wrongAnswers = new Set<number>();
    let attempts = 0;

    while (wrongAnswers.size < count && attempts < WRONG_ANSWER_MAX_ATTEMPTS) {
      attempts++;
      let wrong = correctAnswer;
      
      while (wrong === correctAnswer) {
        const minRange = Math.max(WRONG_ANSWER_MIN_VALUE, correctAnswer - WRONG_ANSWER_RANGE);
        const maxRange = correctAnswer + WRONG_ANSWER_RANGE;
        wrong = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
      }

      if (wrong >= WRONG_ANSWER_MIN_VALUE && wrong <= WRONG_ANSWER_MAX_VALUE) {
        wrongAnswers.add(wrong);
      }
    }

    // Fallback if not enough answers were generated
    if (wrongAnswers.size < count) {
      console.warn(`[MathGameManager] Could only generate ${wrongAnswers.size}/${count} distinct wrong answers for ${correctAnswer} within range/attempts. Using fallback.`);
      
      let fallbackNum = correctAnswer + 1;
      while (wrongAnswers.size < count) {
        if (fallbackNum !== correctAnswer && 
            fallbackNum >= WRONG_ANSWER_MIN_VALUE && 
            fallbackNum <= WRONG_ANSWER_MAX_VALUE &&
            !wrongAnswers.has(fallbackNum)) 
        {
          wrongAnswers.add(fallbackNum);
        }
        fallbackNum++;
        
        if (fallbackNum > WRONG_ANSWER_MAX_VALUE + 5) {
          console.error(`[MathGameManager] Fallback failed to generate ${count} wrong answers for ${correctAnswer}.`);
          break;
        }
      }
    }

    // Ensure we have exactly the required count
    const finalAnswers = Array.from(wrongAnswers);
    while (finalAnswers.length < count) {
      let safetyNum = Math.floor(Math.random() * (WRONG_ANSWER_MAX_VALUE + 1));
      if (safetyNum !== correctAnswer && !finalAnswers.includes(safetyNum)) {
        finalAnswers.push(safetyNum);
      }
      attempts++;
      if (attempts > WRONG_ANSWER_MAX_ATTEMPTS * 2) {
        console.error(`[MathGameManager] Safety net failed to generate ${count} wrong answers for ${correctAnswer}. Returning what we have.`);
        break;
      }
    }

    return finalAnswers.slice(0, count);
  }

  /**
   * Spawn visual effect blocks around the player.
   */
  public spawnTemporaryEffect(
    playerEntity: PlayerEntity,
    textureUri: string,
    count: number = EFFECT_BLOCK_COUNT,
    durationMs: number = EFFECT_BLOCK_DURATION_MS
  ): void {
    const spawnPosition = playerEntity.position;

    console.log(`[MathGameManager] Spawning temporary effect (${textureUri}) near ${playerEntity.player.username} at ${JSON.stringify(spawnPosition)}`);

    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * EFFECT_BLOCK_SPREAD_XZ;
      const offsetY = Math.random() * EFFECT_BLOCK_SPREAD_Y + EFFECT_BLOCK_OFFSET_Y;
      const offsetZ = (Math.random() - 0.5) * EFFECT_BLOCK_SPREAD_XZ;

      const effectBlock = new Entity({
        blockTextureUri: textureUri,
        blockHalfExtents: EFFECT_BLOCK_HALF_EXTENTS,
        rigidBodyOptions: {
          type: RigidBodyType.FIXED,
          colliders: [{
            shape: ColliderShape.BLOCK,
            halfExtents: EFFECT_BLOCK_HALF_EXTENTS,
            isSensor: true
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

  /**
   * Play background music if not already playing.
   * Adds a delay to ensure music starts after the opening voice on mobile.
   */
  private _playBackgroundMusic(): void {
    if (this._backgroundMusic && !this._isMusicPlaying && !this._musicStartTimer) {
      console.log('[MathGameManager] Scheduling background music to start after delay for mobile compatibility...');
      
      // Add delay to allow opening voice to finish and respect mobile audio policies
      this._musicStartTimer = setTimeout(() => {
        try {
          if (this._backgroundMusic && !this._isMusicPlaying) {
            this._backgroundMusic.play(this._world, true);
            this._isMusicPlaying = true;
            console.log('[MathGameManager] Background music started after delay (mobile-friendly).');
          }
        } catch (error) {
          console.error('[MathGameManager] Error playing background music:', error);
        }
        this._musicStartTimer = null;
      }, 4000); // 4 second delay to allow opening voice to finish and respect mobile audio policies
    } else if (this._isMusicPlaying) {
      console.log('[MathGameManager] Background music already playing.');
    } else if (this._musicStartTimer) {
      console.log('[MathGameManager] Background music start already scheduled.');
    } else {
      console.error('[MathGameManager] Background music object is missing, cannot play.');
    }
  }

  /**
   * Stop background music if it is playing.
   */
  private _stopBackgroundMusic(): void {
    // Clear any pending music start timer
    if (this._musicStartTimer) {
      clearTimeout(this._musicStartTimer);
      this._musicStartTimer = null;
      console.log('[MathGameManager] Cancelled scheduled background music start.');
    }
    
    if (this._backgroundMusic && this._isMusicPlaying) {
      try {
        this._backgroundMusic.pause();
        this._isMusicPlaying = false;
        console.log('[MathGameManager] Background music stopped (paused).');
      } catch (error) {
        console.error('[MathGameManager] Error pausing background music:', error);
      }
    } else if (!this._isMusicPlaying) {
      // Music already stopped
    } else {
      console.error('[MathGameManager] Background music object is missing, cannot pause.');
    }
  }

  /**
   * Check if any players have active game sessions.
   */
  private _isAnyPlayerActive(): boolean {
    for (const state of playerGameStateMap.values()) {
      if (state.gameActive) {
        return true;
      }
    }
    return false;
  }

  /**
   * Stop background music if no players are active.
   */
  private _stopBackgroundMusicIfLastPlayer(): void {
    if (!this._isAnyPlayerActive()) {
      console.log('[MathGameManager] No active players remaining, stopping music.');
      this._stopBackgroundMusic();
    } else {
      // Other players are still active
    }
  }
}

/**
 * Start the server and initialize the game.
 */
startServer(world => {
  console.log('[Server] Starting...');
  
  // Create background music
  console.log('[Server] Creating background music object...');
  const backgroundMusic = new Audio({
    uri: AUDIO_MUSIC_BACKGROUND,
    loop: true,
    volume: AUDIO_MUSIC_VOLUME
  });
  console.log('[Server] Background music object created.');

  // Initialize game manager
  new MathGameManager(world, backgroundMusic);
  
  console.log('[Server] Initialization complete. Waiting for players...');
}); 