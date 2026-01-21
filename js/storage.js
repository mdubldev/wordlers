/**
 * localStorage wrapper for managing user identity and league data
 */
const storage = {
  KEYS: {
    LEAGUE_ID: 'wordleague_leagueId',
    PLAYER_ID: 'wordleague_playerId',
    PLAYER_NAME: 'wordleague_playerName',
    IS_ADMIN: 'wordleague_isAdmin'
  },

  /**
   * Get current user's league ID
   */
  getLeagueId() {
    return localStorage.getItem(this.KEYS.LEAGUE_ID);
  },

  /**
   * Get current user's player ID
   */
  getPlayerId() {
    return localStorage.getItem(this.KEYS.PLAYER_ID);
  },

  /**
   * Get current user's display name
   */
  getPlayerName() {
    return localStorage.getItem(this.KEYS.PLAYER_NAME);
  },

  /**
   * Check if current user is league admin
   */
  isAdmin() {
    return localStorage.getItem(this.KEYS.IS_ADMIN) === 'true';
  },

  /**
   * Save user identity after joining/creating a league
   */
  setIdentity(leagueId, playerId, playerName, isAdmin = false) {
    localStorage.setItem(this.KEYS.LEAGUE_ID, leagueId);
    localStorage.setItem(this.KEYS.PLAYER_ID, playerId);
    localStorage.setItem(this.KEYS.PLAYER_NAME, playerName);
    localStorage.setItem(this.KEYS.IS_ADMIN, isAdmin.toString());
  },

  /**
   * Clear all stored data (leave league)
   */
  clear() {
    localStorage.removeItem(this.KEYS.LEAGUE_ID);
    localStorage.removeItem(this.KEYS.PLAYER_ID);
    localStorage.removeItem(this.KEYS.PLAYER_NAME);
    localStorage.removeItem(this.KEYS.IS_ADMIN);
  },

  /**
   * Check if user has an identity set
   */
  hasIdentity() {
    return !!(this.getLeagueId() && this.getPlayerId());
  }
};
