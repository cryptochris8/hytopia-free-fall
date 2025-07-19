import {
  World,
  Player,
  Entity,
  Vector3Like,
  QuaternionLike,
  Quaternion,
  EventHandler
} from 'hytopia';

interface RaceParticipant {
  player: Player;
  playerEntity: Entity;
  currentQuestion: number;
  correctAnswers: number;
  wrongAnswers: number;
  completionTime?: number;
  isFinished: boolean;
  startTime: number;
}

interface RaceSession {
  id: string;
  participants: Map<string, RaceParticipant>;
  questions: any[]; // Will be populated from main game
  startTime: number;
  endTime?: number;
  isActive: boolean;
  winner?: string;
}

export default class CompetitiveRaceManager {
  private static _instance: CompetitiveRaceManager;
  private _world: World | undefined;
  private _activeSessions: Map<string, RaceSession> = new Map();
  private _playerSessions: Map<string, string> = new Map(); // playerId -> sessionId
  private _sessionCounter: number = 0;

  public static get instance(): CompetitiveRaceManager {
    if (!this._instance) {
      this._instance = new CompetitiveRaceManager();
    }
    return this._instance;
  }

  private constructor() {}

  public initialize(world: World): void {
    try {
      if (!world) {
        throw new Error('World instance is required for CompetitiveRaceManager');
      }
      this._world = world;
      console.log('[CompetitiveRaceManager] Initialized successfully');
    } catch (error) {
      console.error('[CompetitiveRaceManager] Failed to initialize:', error);
      throw error;
    }
  }

  public createRaceSession(host: Player): string {
    if (!this._world) throw new Error('CompetitiveRaceManager not initialized');

    const sessionId = `race_${++this._sessionCounter}`;
    const session: RaceSession = {
      id: sessionId,
      participants: new Map(),
      questions: [],
      startTime: 0,
      isActive: false
    };

    this._activeSessions.set(sessionId, session);
    this.addParticipant(sessionId, host);
    
    // Notify host
    this._world.chatManager.sendPlayerMessage(
      host, 
      `Race session created! ID: ${sessionId}. Other players can join with /joinrace ${sessionId}`,
      '00FF00'
    );

    return sessionId;
  }

  public addParticipant(sessionId: string, player: Player): boolean {
    const session = this._activeSessions.get(sessionId);
    if (!session || session.isActive) return false;

    // Remove from any existing session
    const existingSessionId = this._playerSessions.get(player.id);
    if (existingSessionId) {
      this.removeParticipant(existingSessionId, player);
    }

    // Get player entity from global map
    const playerData = (global as any).playerEntityMap?.get(player.username);
    if (!playerData?.entity) {
      console.warn(`[CompetitiveRaceManager] Could not find player entity for ${player.username}`);
      return false;
    }
    const playerEntity = playerData.entity;

    const participant: RaceParticipant = {
      player,
      playerEntity,
      currentQuestion: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      isFinished: false,
      startTime: 0
    };

    session.participants.set(player.id, participant);
    this._playerSessions.set(player.id, sessionId);

    // Notify all participants
    this.broadcastToSession(sessionId, `${player.username} joined the race! (${session.participants.size} players)`);
    
    // Update UI for all participants
    this.updateRaceUI(sessionId);

    return true;
  }

  public removeParticipant(sessionId: string, player: Player): void {
    const session = this._activeSessions.get(sessionId);
    if (!session) return;

    session.participants.delete(player.id);
    this._playerSessions.delete(player.id);

    // If session is empty or only one player left, end it
    if (session.participants.size <= 1) {
      this.endRaceSession(sessionId);
    } else {
      this.broadcastToSession(sessionId, `${player.username} left the race`);
      this.updateRaceUI(sessionId);
    }
  }

  public startRace(sessionId: string, questions: any[]): boolean {
    const session = this._activeSessions.get(sessionId);
    if (!session || session.isActive || session.participants.size < 2) return false;

    session.questions = questions;
    session.startTime = Date.now();
    session.isActive = true;

    // Initialize all participants
    session.participants.forEach((participant) => {
      participant.startTime = Date.now();
      participant.currentQuestion = 0;
      participant.correctAnswers = 0;
      participant.wrongAnswers = 0;
      participant.isFinished = false;
    });

    // Notify all participants
    this.broadcastToSession(sessionId, 'Race started! First to complete 10 questions wins!', '00FF00');
    
    // Send race start event to all participants
    session.participants.forEach((participant) => {
      participant.player.ui.sendData({
        type: 'race-start',
        sessionId,
        totalQuestions: questions.length,
        participants: Array.from(session.participants.values()).map(p => ({
          username: p.player.username,
          progress: 0
        }))
      });
    });

    this.updateRaceUI(sessionId);
    return true;
  }

  public handleAnswerSubmit(player: Player, isCorrect: boolean): void {
    const sessionId = this._playerSessions.get(player.id);
    if (!sessionId) return;

    const session = this._activeSessions.get(sessionId);
    if (!session || !session.isActive) return;

    const participant = session.participants.get(player.id);
    if (!participant || participant.isFinished) return;

    // Update participant stats
    if (isCorrect) {
      participant.correctAnswers++;
      participant.currentQuestion++;
      
      // Check if finished
      if (participant.currentQuestion >= session.questions.length) {
        participant.isFinished = true;
        participant.completionTime = Date.now() - participant.startTime;
        
        // Check if this is the winner
        if (!session.winner) {
          session.winner = player.username;
          this.handleRaceWinner(sessionId, player);
        }
      }
    } else {
      participant.wrongAnswers++;
    }

    // Update race progress for all participants
    this.updateRaceProgress(sessionId);
  }

  private handleRaceWinner(sessionId: string, winner: Player): void {
    const session = this._activeSessions.get(sessionId);
    if (!session) return;

    session.endTime = Date.now();
    const totalTime = (session.endTime - session.startTime) / 1000; // seconds

    // Announce winner
    this.broadcastToSession(
      sessionId, 
      `🏆 ${winner.username} wins the race! Time: ${totalTime.toFixed(1)}s`,
      'FFD700'
    );

    // Send winner announcement to UI
    session.participants.forEach((participant) => {
      participant.player.ui.sendData({
        type: 'race-winner',
        winner: winner.username,
        totalTime: totalTime,
        leaderboard: this.getRaceLeaderboard(sessionId)
      });
    });

    // Award bonus points to winner
    winner.ui.sendData({
      type: 'race-bonus',
      points: 500
    });

    // End session after delay
    setTimeout(() => {
      this.endRaceSession(sessionId);
    }, 10000);
  }

  private updateRaceProgress(sessionId: string): void {
    const session = this._activeSessions.get(sessionId);
    if (!session) return;

    const progress = Array.from(session.participants.values()).map(p => ({
      username: p.player.username,
      progress: (p.currentQuestion / session.questions.length) * 100,
      correctAnswers: p.correctAnswers,
      wrongAnswers: p.wrongAnswers,
      isFinished: p.isFinished
    }));

    // Send progress update to all participants
    session.participants.forEach((participant) => {
      participant.player.ui.sendData({
        type: 'race-progress',
        progress
      });
    });
  }

  private updateRaceUI(sessionId: string): void {
    const session = this._activeSessions.get(sessionId);
    if (!session) return;

    const participants = Array.from(session.participants.values()).map(p => ({
      username: p.player.username,
      isReady: true
    }));

    session.participants.forEach((participant) => {
      participant.player.ui.sendData({
        type: 'race-lobby',
        sessionId,
        participants,
        canStart: session.participants.size >= 2,
        isHost: Array.from(session.participants.keys())[0] === participant.player.id
      });
    });
  }

  private getRaceLeaderboard(sessionId: string): any[] {
    const session = this._activeSessions.get(sessionId);
    if (!session) return [];

    return Array.from(session.participants.values())
      .filter(p => p.isFinished)
      .sort((a, b) => (a.completionTime || 0) - (b.completionTime || 0))
      .map((p, index) => ({
        position: index + 1,
        username: p.player.username,
        time: ((p.completionTime || 0) / 1000).toFixed(1),
        correctAnswers: p.correctAnswers,
        accuracy: ((p.correctAnswers / (p.correctAnswers + p.wrongAnswers)) * 100).toFixed(0)
      }));
  }

  private broadcastToSession(sessionId: string, message: string, color: string = 'FFFFFF'): void {
    const session = this._activeSessions.get(sessionId);
    if (!session || !this._world) return;

    session.participants.forEach((participant) => {
      this._world!.chatManager.sendPlayerMessage(participant.player, message, color);
    });
  }

  private endRaceSession(sessionId: string): void {
    const session = this._activeSessions.get(sessionId);
    if (!session) return;

    // Clean up participant mappings
    session.participants.forEach((participant) => {
      this._playerSessions.delete(participant.player.id);
      
      // Send session end notification
      participant.player.ui.sendData({
        type: 'race-end',
        reason: session.winner ? 'completed' : 'cancelled'
      });
    });

    this._activeSessions.delete(sessionId);
  }

  public getPlayerSession(player: Player): RaceSession | undefined {
    const sessionId = this._playerSessions.get(player.id);
    if (!sessionId) return undefined;
    return this._activeSessions.get(sessionId);
  }

  public isPlayerInRace(player: Player): boolean {
    return this._playerSessions.has(player.id);
  }

  public getSessionInfo(sessionId: string): RaceSession | undefined {
    return this._activeSessions.get(sessionId);
  }
}