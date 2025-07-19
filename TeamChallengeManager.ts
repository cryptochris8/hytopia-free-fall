import {
  World,
  Player,
  Entity,
  Vector3Like
} from 'hytopia';

interface TeamMember {
  player: Player;
  playerEntity: Entity;
  correctAnswers: number;
  wrongAnswers: number;
  contributionScore: number;
  isActive: boolean;
}

interface Team {
  id: string;
  name: string;
  color: string;
  members: Map<string, TeamMember>;
  totalScore: number;
  currentQuestion: number;
  sharedLives: number;
  powerUpsCollected: number;
  teamCombo: number;
}

interface TeamChallenge {
  id: string;
  teams: Map<string, Team>;
  questions: any[];
  startTime: number;
  endTime?: number;
  isActive: boolean;
  winningTeam?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  mode: 'survival' | 'timed' | 'score-attack';
}

export default class TeamChallengeManager {
  private static _instance: TeamChallengeManager;
  private _world: World | undefined;
  private _activeChallenges: Map<string, TeamChallenge> = new Map();
  private _playerTeams: Map<string, { challengeId: string; teamId: string }> = new Map();
  private _challengeCounter: number = 0;

  // Team configuration
  private static readonly TEAM_CONFIGS = [
    { id: 'red', name: 'Red Team', color: 'FF0000' },
    { id: 'blue', name: 'Blue Team', color: '0000FF' },
    { id: 'green', name: 'Green Team', color: '00FF00' },
    { id: 'yellow', name: 'Yellow Team', color: 'FFFF00' }
  ];

  private static readonly TEAM_LIVES = {
    easy: 10,
    medium: 7,
    hard: 5
  };

  public static get instance(): TeamChallengeManager {
    if (!this._instance) {
      this._instance = new TeamChallengeManager();
    }
    return this._instance;
  }

  private constructor() {}

  public initialize(world: World): void {
    this._world = world;
  }

  public createTeamChallenge(host: Player, mode: 'survival' | 'timed' | 'score-attack' = 'survival'): string {
    if (!this._world) throw new Error('TeamChallengeManager not initialized');

    const challengeId = `team_${++this._challengeCounter}`;
    const challenge: TeamChallenge = {
      id: challengeId,
      teams: new Map(),
      questions: [],
      startTime: 0,
      isActive: false,
      difficulty: 'medium',
      mode
    };

    // Create initial teams
    TeamChallengeManager.TEAM_CONFIGS.slice(0, 2).forEach(config => {
      const team: Team = {
        id: config.id,
        name: config.name,
        color: config.color,
        members: new Map(),
        totalScore: 0,
        currentQuestion: 0,
        sharedLives: TeamChallengeManager.TEAM_LIVES.medium,
        powerUpsCollected: 0,
        teamCombo: 0
      };
      challenge.teams.set(config.id, team);
    });

    this._activeChallenges.set(challengeId, challenge);
    
    // Add host to first team
    this.addPlayerToTeam(challengeId, 'red', host);

    // Notify host
    this._world.chatManager.sendPlayerMessage(
      host,
      `Team challenge created! ID: ${challengeId}. Mode: ${mode}. Players can join with /jointeam ${challengeId}`,
      '00FF00'
    );

    return challengeId;
  }

  public addPlayerToTeam(challengeId: string, teamId: string, player: Player): boolean {
    const challenge = this._activeChallenges.get(challengeId);
    if (!challenge || challenge.isActive) return false;

    const team = challenge.teams.get(teamId);
    if (!team) return false;

    // Remove from any existing team
    this.removePlayerFromChallenge(player);

    // Get player entity from global map
    const playerData = (global as any).playerEntityMap?.get(player.username);
    if (!playerData?.entity) {
      console.warn(`[TeamChallengeManager] Could not find player entity for ${player.username}`);
      return false;
    }
    const playerEntity = playerData.entity;

    const member: TeamMember = {
      player,
      playerEntity,
      correctAnswers: 0,
      wrongAnswers: 0,
      contributionScore: 0,
      isActive: true
    };

    team.members.set(player.id, member);
    this._playerTeams.set(player.id, { challengeId, teamId });

    // Update team color indicator for player
    player.ui.sendData({
      type: 'team-joined',
      teamName: team.name,
      teamColor: team.color
    });

    // Broadcast to all teams
    this.broadcastToChallenge(
      challengeId,
      `${player.username} joined ${team.name}!`,
      team.color
    );

    this.updateTeamUI(challengeId);
    return true;
  }

  public autoBalanceTeams(challengeId: string): void {
    const challenge = this._activeChallenges.get(challengeId);
    if (!challenge || challenge.isActive) return;

    // Get all players
    const allPlayers: { player: Player; teamId: string }[] = [];
    challenge.teams.forEach((team, teamId) => {
      team.members.forEach((member) => {
        allPlayers.push({ player: member.player, teamId });
      });
    });

    // Shuffle players
    for (let i = allPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
    }

    // Clear teams
    challenge.teams.forEach(team => team.members.clear());
    this._playerTeams.clear();

    // Redistribute players evenly
    const teamIds = Array.from(challenge.teams.keys());
    allPlayers.forEach((playerInfo, index) => {
      const teamId = teamIds[index % teamIds.length];
      this.addPlayerToTeam(challengeId, teamId, playerInfo.player);
    });

    this.broadcastToChallenge(challengeId, 'Teams have been auto-balanced!', 'FFFF00');
  }

  public startTeamChallenge(challengeId: string, questions: any[], difficulty: 'easy' | 'medium' | 'hard' = 'medium'): boolean {
    const challenge = this._activeChallenges.get(challengeId);
    if (!challenge || challenge.isActive) return false;

    // Ensure at least 2 players per team
    let validTeams = 0;
    challenge.teams.forEach(team => {
      if (team.members.size > 0) validTeams++;
    });
    if (validTeams < 2) return false;

    challenge.questions = questions;
    challenge.startTime = Date.now();
    challenge.isActive = true;
    challenge.difficulty = difficulty;

    // Initialize teams
    challenge.teams.forEach(team => {
      team.sharedLives = TeamChallengeManager.TEAM_LIVES[difficulty];
      team.totalScore = 0;
      team.currentQuestion = 0;
      team.teamCombo = 0;
    });

    // Notify all players
    this.broadcastToChallenge(
      challengeId,
      `Team challenge started! Mode: ${challenge.mode}, Difficulty: ${difficulty}`,
      '00FF00'
    );

    // Send UI updates
    challenge.teams.forEach(team => {
      team.members.forEach(member => {
        member.player.ui.sendData({
          type: 'team-challenge-start',
          mode: challenge.mode,
          difficulty,
          teamName: team.name,
          teamColor: team.color,
          sharedLives: team.sharedLives,
          totalQuestions: questions.length
        });
      });
    });

    this.updateTeamProgress(challengeId);
    return true;
  }

  public handleTeamAnswer(player: Player, isCorrect: boolean, timeBonus: number = 0): void {
    const playerInfo = this._playerTeams.get(player.id);
    if (!playerInfo) return;

    const challenge = this._activeChallenges.get(playerInfo.challengeId);
    if (!challenge || !challenge.isActive) return;

    const team = challenge.teams.get(playerInfo.teamId);
    const member = team?.members.get(player.id);
    if (!team || !member) return;

    if (isCorrect) {
      member.correctAnswers++;
      team.teamCombo++;
      
      // Calculate score with combo multiplier
      const baseScore = 100;
      const comboBonus = Math.min(team.teamCombo * 10, 50);
      const totalScore = baseScore + comboBonus + timeBonus;
      
      member.contributionScore += totalScore;
      team.totalScore += totalScore;

      // Team advances together
      team.currentQuestion++;

      // Check win conditions
      if (this.checkWinCondition(challenge, team)) {
        this.handleTeamVictory(challenge, team);
        return;
      }

      // Notify team of combo
      if (team.teamCombo > 2) {
        this.broadcastToTeam(
          challenge,
          playerInfo.teamId,
          `${player.username} got it right! Combo x${team.teamCombo}!`,
          '00FF00'
        );
      }
    } else {
      member.wrongAnswers++;
      team.teamCombo = 0; // Reset combo
      team.sharedLives--;

      // Notify team of life loss
      this.broadcastToTeam(
        challenge,
        playerInfo.teamId,
        `Wrong answer! ${team.sharedLives} lives remaining!`,
        'FF0000'
      );

      // Check if team is eliminated
      if (team.sharedLives <= 0) {
        this.eliminateTeam(challenge, team);
      }
    }

    this.updateTeamProgress(playerInfo.challengeId);
  }

  public handleTeamPowerUp(player: Player, powerUpType: string): void {
    const playerInfo = this._playerTeams.get(player.id);
    if (!playerInfo) return;

    const challenge = this._activeChallenges.get(playerInfo.challengeId);
    const team = challenge?.teams.get(playerInfo.teamId);
    if (!challenge || !team) return;

    team.powerUpsCollected++;

    // Apply team-wide power-up effects
    team.members.forEach(member => {
      member.player.ui.sendData({
        type: 'team-powerup',
        powerUpType,
        teamBonus: true
      });
    });

    this.broadcastToTeam(
      challenge,
      playerInfo.teamId,
      `${player.username} collected a ${powerUpType} for the team!`,
      'FFFF00'
    );
  }

  private checkWinCondition(challenge: TeamChallenge, team: Team): boolean {
    switch (challenge.mode) {
      case 'survival':
        return team.currentQuestion >= challenge.questions.length;
      case 'score-attack':
        return team.totalScore >= 5000; // First to 5000 points
      case 'timed':
        // Check if time limit reached (handled elsewhere)
        return false;
      default:
        return false;
    }
  }

  private handleTeamVictory(challenge: TeamChallenge, winningTeam: Team): void {
    challenge.endTime = Date.now();
    challenge.winningTeam = winningTeam.id;
    challenge.isActive = false;

    const duration = ((challenge.endTime - challenge.startTime) / 1000).toFixed(1);

    // Announce victory
    this.broadcastToChallenge(
      challenge.id,
      `🏆 ${winningTeam.name} wins! Total score: ${winningTeam.totalScore}, Time: ${duration}s`,
      winningTeam.color
    );

    // Send victory UI and stats
    challenge.teams.forEach(team => {
      const isWinner = team.id === winningTeam.id;
      team.members.forEach(member => {
        member.player.ui.sendData({
          type: 'team-challenge-end',
          victory: isWinner,
          teamStats: {
            totalScore: team.totalScore,
            questionsCompleted: team.currentQuestion,
            accuracy: this.calculateTeamAccuracy(team),
            mvp: this.getTeamMVP(team)
          },
          personalStats: {
            contribution: member.contributionScore,
            accuracy: this.calculateMemberAccuracy(member)
          },
          bonusPoints: isWinner ? 1000 : 250
        });
      });
    });

    // End challenge after delay
    setTimeout(() => {
      this.endTeamChallenge(challenge.id);
    }, 15000);
  }

  private eliminateTeam(challenge: TeamChallenge, team: Team): void {
    team.members.forEach(member => {
      member.isActive = false;
      member.player.ui.sendData({
        type: 'team-eliminated',
        reason: 'no-lives'
      });
    });

    this.broadcastToChallenge(
      challenge.id,
      `${team.name} has been eliminated!`,
      team.color
    );

    // Check if only one team remains
    const activeTeams = Array.from(challenge.teams.values()).filter(t => 
      Array.from(t.members.values()).some(m => m.isActive)
    );

    if (activeTeams.length === 1) {
      this.handleTeamVictory(challenge, activeTeams[0]);
    }
  }

  private updateTeamProgress(challengeId: string): void {
    const challenge = this._activeChallenges.get(challengeId);
    if (!challenge) return;

    const teamStats = Array.from(challenge.teams.entries()).map(([teamId, team]) => ({
      teamId,
      teamName: team.name,
      teamColor: team.color,
      score: team.totalScore,
      progress: (team.currentQuestion / challenge.questions.length) * 100,
      lives: team.sharedLives,
      combo: team.teamCombo,
      members: Array.from(team.members.values()).map(m => ({
        username: m.player.username,
        contribution: m.contributionScore,
        isActive: m.isActive
      }))
    }));

    // Send to all players
    challenge.teams.forEach(team => {
      team.members.forEach(member => {
        member.player.ui.sendData({
          type: 'team-progress',
          teamStats,
          currentTeam: team.id
        });
      });
    });
  }

  private calculateTeamAccuracy(team: Team): number {
    let totalCorrect = 0;
    let totalWrong = 0;

    team.members.forEach(member => {
      totalCorrect += member.correctAnswers;
      totalWrong += member.wrongAnswers;
    });

    const total = totalCorrect + totalWrong;
    return total > 0 ? (totalCorrect / total) * 100 : 0;
  }

  private calculateMemberAccuracy(member: TeamMember): number {
    const total = member.correctAnswers + member.wrongAnswers;
    return total > 0 ? (member.correctAnswers / total) * 100 : 0;
  }

  private getTeamMVP(team: Team): string {
    let mvp = '';
    let highestContribution = 0;

    team.members.forEach(member => {
      if (member.contributionScore > highestContribution) {
        highestContribution = member.contributionScore;
        mvp = member.player.username;
      }
    });

    return mvp;
  }

  private broadcastToChallenge(challengeId: string, message: string, color: string = 'FFFFFF'): void {
    const challenge = this._activeChallenges.get(challengeId);
    if (!challenge || !this._world) return;

    challenge.teams.forEach(team => {
      team.members.forEach(member => {
        this._world!.chatManager.sendPlayerMessage(member.player, message, color);
      });
    });
  }

  private broadcastToTeam(challenge: TeamChallenge, teamId: string, message: string, color: string): void {
    const team = challenge.teams.get(teamId);
    if (!team || !this._world) return;

    team.members.forEach(member => {
      this._world!.chatManager.sendPlayerMessage(member.player, `[TEAM] ${message}`, color);
    });
  }

  private updateTeamUI(challengeId: string): void {
    const challenge = this._activeChallenges.get(challengeId);
    if (!challenge) return;

    const teamInfo = Array.from(challenge.teams.entries()).map(([teamId, team]) => ({
      teamId,
      teamName: team.name,
      teamColor: team.color,
      members: Array.from(team.members.values()).map(m => m.player.username),
      isFull: team.members.size >= 4
    }));

    // Send to all players in challenge
    challenge.teams.forEach(team => {
      team.members.forEach(member => {
        member.player.ui.sendData({
          type: 'team-lobby',
          challengeId,
          teams: teamInfo,
          currentTeam: team.id,
          canStart: this.canStartChallenge(challenge),
          mode: challenge.mode
        });
      });
    });
  }

  private canStartChallenge(challenge: TeamChallenge): boolean {
    let teamsWithPlayers = 0;
    challenge.teams.forEach(team => {
      if (team.members.size > 0) teamsWithPlayers++;
    });
    return teamsWithPlayers >= 2;
  }

  private removePlayerFromChallenge(player: Player): void {
    const playerInfo = this._playerTeams.get(player.id);
    if (!playerInfo) return;

    const challenge = this._activeChallenges.get(playerInfo.challengeId);
    const team = challenge?.teams.get(playerInfo.teamId);
    
    if (team) {
      team.members.delete(player.id);
      this._playerTeams.delete(player.id);
      
      this.broadcastToChallenge(
        playerInfo.challengeId,
        `${player.username} left ${team.name}`,
        team.color
      );
      
      this.updateTeamUI(playerInfo.challengeId);
    }
  }

  private endTeamChallenge(challengeId: string): void {
    const challenge = this._activeChallenges.get(challengeId);
    if (!challenge) return;

    // Clean up
    challenge.teams.forEach(team => {
      team.members.forEach(member => {
        this._playerTeams.delete(member.player.id);
        member.player.ui.sendData({
          type: 'team-challenge-cleanup'
        });
      });
    });

    this._activeChallenges.delete(challengeId);
  }

  public getPlayerTeam(player: Player): { challenge: TeamChallenge; team: Team } | undefined {
    const playerInfo = this._playerTeams.get(player.id);
    if (!playerInfo) return undefined;

    const challenge = this._activeChallenges.get(playerInfo.challengeId);
    const team = challenge?.teams.get(playerInfo.teamId);
    
    if (challenge && team) {
      return { challenge, team };
    }
    return undefined;
  }

  public isPlayerInTeamChallenge(player: Player): boolean {
    return this._playerTeams.has(player.id);
  }
}