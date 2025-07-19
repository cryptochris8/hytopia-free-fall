import {
  World,
  Player,
  ChatManager
} from 'hytopia';

interface Friend {
  playerId: string;
  username: string;
  addedDate: number;
  isOnline: boolean;
  lastSeen: number;
}

interface PlayerProfile {
  playerId: string;
  username: string;
  bio: string;
  favoriteSubject: string;
  playStyle: string; // 'competitive', 'casual', 'learner'
  preferredDifficulty: string;
  friends: Map<string, Friend>;
  blockedPlayers: Set<string>;
  visibility: 'public' | 'friends' | 'private';
  allowFriendRequests: boolean;
  allowChallengeInvites: boolean;
}

interface FriendRequest {
  fromPlayerId: string;
  fromUsername: string;
  toPlayerId: string;
  sentTime: number;
  message?: string;
}

interface SocialNotification {
  id: string;
  type: 'friend_request' | 'friend_accepted' | 'challenge_invite' | 'achievement' | 'message';
  fromPlayer?: string;
  content: string;
  timestamp: number;
  read: boolean;
}

export default class SocialFeaturesSystem {
  private static _instance: SocialFeaturesSystem;
  private _world: World | undefined;
  private _playerProfiles: Map<string, PlayerProfile> = new Map();
  private _friendRequests: Map<string, FriendRequest[]> = new Map();
  private _notifications: Map<string, SocialNotification[]> = new Map();
  private _onlinePlayers: Set<string> = new Set();
  private _notificationCounter: number = 0;

  // Social commands
  public static readonly COMMANDS = {
    ADD_FRIEND: '/friend add',
    REMOVE_FRIEND: '/friend remove',
    FRIEND_LIST: '/friends',
    PROFILE: '/profile',
    SET_BIO: '/setbio',
    SET_VISIBILITY: '/setvisibility',
    BLOCK: '/block',
    UNBLOCK: '/unblock',
    WHISPER: '/w',
    INVITE_RACE: '/inviterace',
    INVITE_TEAM: '/inviteteam'
  };

  public static get instance(): SocialFeaturesSystem {
    if (!this._instance) {
      this._instance = new SocialFeaturesSystem();
    }
    return this._instance;
  }

  private constructor() {}

  public initialize(world: World): void {
    this._world = world;
    
    // Set up chat command handlers
    this.setupChatCommands();
  }

  public async loadPlayerProfile(player: Player): Promise<PlayerProfile> {
    // Mark player as online
    this._onlinePlayers.add(player.id);

    // Try to load from persisted data (if available)
    let persistedData = null;
    if (player.getPersistedData && typeof player.getPersistedData === 'function') {
      try {
        persistedData = await player.getPersistedData();
      } catch (error) {
        console.warn('[SocialFeaturesSystem] Failed to load persisted data:', error);
      }
    }
    
    if (persistedData && persistedData.socialProfile) {
      const profile = persistedData.socialProfile as any;
      
      // Convert stored data back to Maps/Sets
      const loadedProfile: PlayerProfile = {
        ...profile,
        friends: new Map(profile.friends || []),
        blockedPlayers: new Set(profile.blockedPlayers || [])
      };
      
      this._playerProfiles.set(player.id, loadedProfile);
      
      // Update friend online status
      this.updateFriendOnlineStatus(loadedProfile);
      
      // Send pending notifications
      this.sendPendingNotifications(player);
      
      return loadedProfile;
    }

    // Create new profile
    const newProfile: PlayerProfile = {
      playerId: player.id,
      username: player.username,
      bio: 'New Free Fall player!',
      favoriteSubject: 'arithmetic',
      playStyle: 'casual',
      preferredDifficulty: 'medium',
      friends: new Map(),
      blockedPlayers: new Set(),
      visibility: 'public',
      allowFriendRequests: true,
      allowChallengeInvites: true
    };

    this._playerProfiles.set(player.id, newProfile);
    this.savePlayerProfile(player, newProfile);
    
    return newProfile;
  }

  public onPlayerDisconnect(player: Player): void {
    this._onlinePlayers.delete(player.id);
    
    const profile = this._playerProfiles.get(player.id);
    if (profile) {
      // Update last seen for friends
      profile.friends.forEach(friend => {
        const friendProfile = this._playerProfiles.get(friend.playerId);
        if (friendProfile) {
          const friendsFriend = friendProfile.friends.get(player.id);
          if (friendsFriend) {
            friendsFriend.isOnline = false;
            friendsFriend.lastSeen = Date.now();
          }
        }
      });
    }
  }

  public sendFriendRequest(fromPlayer: Player, toUsername: string, message?: string): boolean {
    if (!this._world) return false;

    // Find target player
    const toPlayer = this.findPlayerByUsername(toUsername);
    if (!toPlayer) {
      this._world.chatManager.sendPlayerMessage(
        fromPlayer,
        `Player "${toUsername}" not found.`,
        'FF0000'
      );
      return false;
    }

    const fromProfile = this._playerProfiles.get(fromPlayer.id);
    const toProfile = this._playerProfiles.get(toPlayer.id);
    
    if (!fromProfile || !toProfile) return false;

    // Check if already friends
    if (fromProfile.friends.has(toPlayer.id)) {
      this._world.chatManager.sendPlayerMessage(
        fromPlayer,
        `You are already friends with ${toUsername}.`,
        'FFFF00'
      );
      return false;
    }

    // Check if blocked
    if (toProfile.blockedPlayers.has(fromPlayer.id)) {
      this._world.chatManager.sendPlayerMessage(
        fromPlayer,
        `Unable to send friend request to ${toUsername}.`,
        'FF0000'
      );
      return false;
    }

    // Check if friend requests are allowed
    if (!toProfile.allowFriendRequests) {
      this._world.chatManager.sendPlayerMessage(
        fromPlayer,
        `${toUsername} is not accepting friend requests.`,
        'FF0000'
      );
      return false;
    }

    // Create friend request
    const request: FriendRequest = {
      fromPlayerId: fromPlayer.id,
      fromUsername: fromPlayer.username,
      toPlayerId: toPlayer.id,
      sentTime: Date.now(),
      message
    };

    // Add to pending requests
    const requests = this._friendRequests.get(toPlayer.id) || [];
    
    // Check if request already exists
    if (requests.some(r => r.fromPlayerId === fromPlayer.id)) {
      this._world.chatManager.sendPlayerMessage(
        fromPlayer,
        `You already have a pending friend request to ${toUsername}.`,
        'FFFF00'
      );
      return false;
    }

    requests.push(request);
    this._friendRequests.set(toPlayer.id, requests);

    // Send notification
    this.addNotification(toPlayer.id, {
      type: 'friend_request',
      fromPlayer: fromPlayer.username,
      content: `${fromPlayer.username} sent you a friend request!${message ? ` Message: ${message}` : ''}`,
      timestamp: Date.now()
    });

    // Confirm to sender
    this._world.chatManager.sendPlayerMessage(
      fromPlayer,
      `Friend request sent to ${toUsername}!`,
      '00FF00'
    );

    // If recipient is online, notify them
    if (this._onlinePlayers.has(toPlayer.id)) {
      const onlinePlayer = this.getOnlinePlayer(toPlayer.id);
      if (onlinePlayer) {
        this._world.chatManager.sendPlayerMessage(
          onlinePlayer,
          `${fromPlayer.username} sent you a friend request! Type /friends to view.`,
          '00FF00'
        );
      }
    }

    return true;
  }

  public acceptFriendRequest(player: Player, fromUsername: string): boolean {
    if (!this._world) return false;

    const requests = this._friendRequests.get(player.id) || [];
    const requestIndex = requests.findIndex(r => r.fromUsername === fromUsername);
    
    if (requestIndex === -1) {
      this._world.chatManager.sendPlayerMessage(
        player,
        `No friend request from ${fromUsername}.`,
        'FF0000'
      );
      return false;
    }

    const request = requests[requestIndex];
    const playerProfile = this._playerProfiles.get(player.id);
    const friendProfile = this._playerProfiles.get(request.fromPlayerId);
    
    if (!playerProfile || !friendProfile) return false;

    // Add as friends
    const playerFriend: Friend = {
      playerId: request.fromPlayerId,
      username: request.fromUsername,
      addedDate: Date.now(),
      isOnline: this._onlinePlayers.has(request.fromPlayerId),
      lastSeen: Date.now()
    };

    const friendsFriend: Friend = {
      playerId: player.id,
      username: player.username,
      addedDate: Date.now(),
      isOnline: true,
      lastSeen: Date.now()
    };

    playerProfile.friends.set(request.fromPlayerId, playerFriend);
    friendProfile.friends.set(player.id, friendsFriend);

    // Remove request
    requests.splice(requestIndex, 1);
    this._friendRequests.set(player.id, requests);

    // Save profiles
    this.savePlayerProfile(player, playerProfile);
    
    // Send notifications
    this._world.chatManager.sendPlayerMessage(
      player,
      `You are now friends with ${fromUsername}!`,
      '00FF00'
    );

    this.addNotification(request.fromPlayerId, {
      type: 'friend_accepted',
      fromPlayer: player.username,
      content: `${player.username} accepted your friend request!`,
      timestamp: Date.now()
    });

    // If friend is online, notify them
    if (this._onlinePlayers.has(request.fromPlayerId)) {
      const onlineFriend = this.getOnlinePlayer(request.fromPlayerId);
      if (onlineFriend) {
        this._world.chatManager.sendPlayerMessage(
          onlineFriend,
          `${player.username} accepted your friend request!`,
          '00FF00'
        );
      }
    }

    return true;
  }

  public removeFriend(player: Player, friendUsername: string): boolean {
    if (!this._world) return false;

    const playerProfile = this._playerProfiles.get(player.id);
    if (!playerProfile) return false;

    // Find friend
    let friendId: string | undefined;
    playerProfile.friends.forEach((friend, id) => {
      if (friend.username === friendUsername) {
        friendId = id;
      }
    });

    if (!friendId) {
      this._world.chatManager.sendPlayerMessage(
        player,
        `${friendUsername} is not in your friends list.`,
        'FF0000'
      );
      return false;
    }

    // Remove from both sides
    playerProfile.friends.delete(friendId);
    
    const friendProfile = this._playerProfiles.get(friendId);
    if (friendProfile) {
      friendProfile.friends.delete(player.id);
    }

    // Save profiles
    this.savePlayerProfile(player, playerProfile);

    this._world.chatManager.sendPlayerMessage(
      player,
      `${friendUsername} has been removed from your friends list.`,
      'FFFF00'
    );

    return true;
  }

  public whisper(fromPlayer: Player, toUsername: string, message: string): boolean {
    if (!this._world) return false;

    const toPlayer = this.findPlayerByUsername(toUsername);
    if (!toPlayer || !this._onlinePlayers.has(toPlayer.id)) {
      this._world.chatManager.sendPlayerMessage(
        fromPlayer,
        `${toUsername} is not online.`,
        'FF0000'
      );
      return false;
    }

    const toProfile = this._playerProfiles.get(toPlayer.id);
    if (toProfile?.blockedPlayers.has(fromPlayer.id)) {
      this._world.chatManager.sendPlayerMessage(
        fromPlayer,
        `Unable to send message to ${toUsername}.`,
        'FF0000'
      );
      return false;
    }

    // Send whisper
    const onlineToPlayer = this.getOnlinePlayer(toPlayer.id);
    if (onlineToPlayer) {
      this._world.chatManager.sendPlayerMessage(
        onlineToPlayer,
        `[Whisper from ${fromPlayer.username}] ${message}`,
        'FF00FF'
      );
      
      this._world.chatManager.sendPlayerMessage(
        fromPlayer,
        `[Whisper to ${toUsername}] ${message}`,
        'FF00FF'
      );

      return true;
    }

    return false;
  }

  public inviteToRace(fromPlayer: Player, toUsername: string, raceSessionId: string): boolean {
    if (!this._world) return false;

    const toPlayer = this.findPlayerByUsername(toUsername);
    if (!toPlayer || !this._onlinePlayers.has(toPlayer.id)) {
      this._world.chatManager.sendPlayerMessage(
        fromPlayer,
        `${toUsername} is not online.`,
        'FF0000'
      );
      return false;
    }

    const toProfile = this._playerProfiles.get(toPlayer.id);
    if (!toProfile?.allowChallengeInvites || toProfile.blockedPlayers.has(fromPlayer.id)) {
      this._world.chatManager.sendPlayerMessage(
        fromPlayer,
        `${toUsername} is not accepting challenge invites.`,
        'FF0000'
      );
      return false;
    }

    // Send invite
    this.addNotification(toPlayer.id, {
      type: 'challenge_invite',
      fromPlayer: fromPlayer.username,
      content: `${fromPlayer.username} invited you to a race! Join with /joinrace ${raceSessionId}`,
      timestamp: Date.now()
    });

    const onlineToPlayer = this.getOnlinePlayer(toPlayer.id);
    if (onlineToPlayer) {
      this._world.chatManager.sendPlayerMessage(
        onlineToPlayer,
        `${fromPlayer.username} invited you to a race! Join with /joinrace ${raceSessionId}`,
        '00FF00'
      );
    }

    this._world.chatManager.sendPlayerMessage(
      fromPlayer,
      `Race invite sent to ${toUsername}!`,
      '00FF00'
    );

    return true;
  }

  public getFriendsList(player: Player): Friend[] {
    const profile = this._playerProfiles.get(player.id);
    if (!profile) return [];

    return Array.from(profile.friends.values()).sort((a, b) => {
      // Online friends first
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      // Then by username
      return a.username.localeCompare(b.username);
    });
  }

  public getOnlineFriends(player: Player): Friend[] {
    return this.getFriendsList(player).filter(f => f.isOnline);
  }

  public updateProfile(player: Player, updates: Partial<PlayerProfile>): void {
    const profile = this._playerProfiles.get(player.id);
    if (!profile) return;

    // Apply updates
    if (updates.bio !== undefined) profile.bio = updates.bio;
    if (updates.favoriteSubject !== undefined) profile.favoriteSubject = updates.favoriteSubject;
    if (updates.playStyle !== undefined) profile.playStyle = updates.playStyle;
    if (updates.preferredDifficulty !== undefined) profile.preferredDifficulty = updates.preferredDifficulty;
    if (updates.visibility !== undefined) profile.visibility = updates.visibility;
    if (updates.allowFriendRequests !== undefined) profile.allowFriendRequests = updates.allowFriendRequests;
    if (updates.allowChallengeInvites !== undefined) profile.allowChallengeInvites = updates.allowChallengeInvites;

    this.savePlayerProfile(player, profile);

    if (this._world) {
      this._world.chatManager.sendPlayerMessage(
        player,
        'Profile updated successfully!',
        '00FF00'
      );
    }
  }

  public blockPlayer(player: Player, targetUsername: string): boolean {
    if (!this._world) return false;

    const targetPlayer = this.findPlayerByUsername(targetUsername);
    if (!targetPlayer) {
      this._world.chatManager.sendPlayerMessage(
        player,
        `Player "${targetUsername}" not found.`,
        'FF0000'
      );
      return false;
    }

    const profile = this._playerProfiles.get(player.id);
    if (!profile) return false;

    // Add to blocked list
    profile.blockedPlayers.add(targetPlayer.id);

    // Remove from friends if they were friends
    if (profile.friends.has(targetPlayer.id)) {
      this.removeFriend(player, targetUsername);
    }

    this.savePlayerProfile(player, profile);

    this._world.chatManager.sendPlayerMessage(
      player,
      `${targetUsername} has been blocked.`,
      'FFFF00'
    );

    return true;
  }

  public unblockPlayer(player: Player, targetUsername: string): boolean {
    if (!this._world) return false;

    const targetPlayer = this.findPlayerByUsername(targetUsername);
    if (!targetPlayer) {
      this._world.chatManager.sendPlayerMessage(
        player,
        `Player "${targetUsername}" not found.`,
        'FF0000'
      );
      return false;
    }

    const profile = this._playerProfiles.get(player.id);
    if (!profile) return false;

    if (!profile.blockedPlayers.has(targetPlayer.id)) {
      this._world.chatManager.sendPlayerMessage(
        player,
        `${targetUsername} is not blocked.`,
        'FF0000'
      );
      return false;
    }

    profile.blockedPlayers.delete(targetPlayer.id);
    this.savePlayerProfile(player, profile);

    this._world.chatManager.sendPlayerMessage(
      player,
      `${targetUsername} has been unblocked.`,
      '00FF00'
    );

    return true;
  }

  private addNotification(playerId: string, notification: Omit<SocialNotification, 'id' | 'read'>): void {
    const notifications = this._notifications.get(playerId) || [];
    
    notifications.push({
      ...notification,
      id: `notif_${++this._notificationCounter}`,
      read: false
    });

    // Keep only last 50 notifications
    if (notifications.length > 50) {
      notifications.splice(0, notifications.length - 50);
    }

    this._notifications.set(playerId, notifications);
  }

  private sendPendingNotifications(player: Player): void {
    const notifications = this._notifications.get(player.id) || [];
    const unread = notifications.filter(n => !n.read);

    if (unread.length > 0) {
      player.ui.sendData({
        type: 'social-notifications',
        notifications: unread
      });

      // Mark as read
      notifications.forEach(n => n.read = true);
    }

    // Send friend requests
    const requests = this._friendRequests.get(player.id) || [];
    if (requests.length > 0) {
      player.ui.sendData({
        type: 'friend-requests',
        requests: requests.map(r => ({
          from: r.fromUsername,
          message: r.message,
          time: r.sentTime
        }))
      });
    }
  }

  private updateFriendOnlineStatus(profile: PlayerProfile): void {
    profile.friends.forEach(friend => {
      friend.isOnline = this._onlinePlayers.has(friend.playerId);
      
      // Update friend's view of this player
      const friendProfile = this._playerProfiles.get(friend.playerId);
      if (friendProfile) {
        const friendsFriend = friendProfile.friends.get(profile.playerId);
        if (friendsFriend) {
          friendsFriend.isOnline = true;
          friendsFriend.lastSeen = Date.now();
        }
      }
    });
  }

  private findPlayerByUsername(username: string): { id: string; username: string } | undefined {
    // First check online players
    for (const profile of this._playerProfiles.values()) {
      if (profile.username.toLowerCase() === username.toLowerCase()) {
        return { id: profile.playerId, username: profile.username };
      }
    }
    
    // TODO: In a real implementation, you'd check a database for offline players
    return undefined;
  }

  private getOnlinePlayer(playerId: string): Player | undefined {
    if (!this._world || !this._onlinePlayers.has(playerId)) return undefined;

    // Find player from global map by iterating through entries
    const playerEntityMap = (global as any).playerEntityMap;
    if (!playerEntityMap) return undefined;

    for (const [username, playerData] of playerEntityMap.entries()) {
      if (playerData?.entity?.player?.id === playerId) {
        return playerData.entity.player;
      }
    }

    return undefined;
  }

  private savePlayerProfile(player: Player, profile: PlayerProfile): void {
    // Convert Maps/Sets to arrays for storage
    const storableProfile = {
      ...profile,
      friends: Array.from(profile.friends.entries()),
      blockedPlayers: Array.from(profile.blockedPlayers)
    };

    // Check if player has persisted data methods (may not be available in local dev)
    if (player.getPersistedData && typeof player.getPersistedData === 'function') {
      const persistedDataPromise = player.getPersistedData();
      if (persistedDataPromise && typeof persistedDataPromise.then === 'function') {
        persistedDataPromise.then(data => {
          const updatedData = {
            ...data,
            socialProfile: storableProfile
          };
          player.setPersistedData(updatedData);
        }).catch(error => {
          console.error('[SocialFeaturesSystem] Failed to save player profile:', error);
        });
      }
    } else {
      console.warn('[SocialFeaturesSystem] Player persistence not available in current environment');
    }
  }

  private setupChatCommands(): void {
    // This would integrate with the chat system to handle commands
    // For now, these are just placeholders showing the command structure
    
    // The actual implementation would hook into the world's chat system
    // and parse commands like:
    // - /friend add <username> [message]
    // - /friend remove <username>
    // - /friends (list friends)
    // - /profile <username> (view profile)
    // - /setbio <new bio>
    // - /w <username> <message> (whisper)
    // etc.
  }

  public getPlayerProfile(player: Player): PlayerProfile | undefined {
    return this._playerProfiles.get(player.id);
  }

  public isPlayerOnline(playerId: string): boolean {
    return this._onlinePlayers.has(playerId);
  }
}