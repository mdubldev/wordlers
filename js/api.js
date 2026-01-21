/**
 * Convex API wrapper
 * This file initializes the Convex client and provides methods for interacting with the backend
 */

// Will be initialized after Convex is set up
let convexClient = null;

const api = {
  /**
   * Initialize the Convex client
   * @param {string} deploymentUrl - The Convex deployment URL
   */
  init(deploymentUrl) {
    if (!deploymentUrl) {
      console.warn('Convex deployment URL not configured');
      return;
    }
    convexClient = new convex.ConvexClient(deploymentUrl);
  },

  /**
   * Check if API is ready
   */
  isReady() {
    return convexClient !== null;
  },

  /**
   * Create a new league
   * @param {string} name - League name
   * @param {string[]} playerNames - Array of player names
   * @returns {Promise<{ leagueId: string, inviteCode: string, players: Array<{ id: string, name: string }> }>}
   */
  async createLeague(name, playerNames) {
    if (!convexClient) throw new Error('API not initialized');
    return await convexClient.mutation('leagues:create', { name, playerNames });
  },

  /**
   * Find a league by invite code
   * @param {string} inviteCode - The invite code
   * @returns {Promise<{ leagueId: string, name: string, players: Array<{ id: string, name: string }> } | null>}
   */
  async findLeague(inviteCode) {
    if (!convexClient) throw new Error('API not initialized');
    return await convexClient.query('leagues:findByCode', { inviteCode: inviteCode.toUpperCase() });
  },

  /**
   * Get league info by ID
   * @param {string} leagueId - The league ID
   * @returns {Promise<{ name: string, inviteCode: string, creatorPlayerId: string | null }>}
   */
  async getLeague(leagueId) {
    if (!convexClient) throw new Error('API not initialized');
    return await convexClient.query('leagues:get', { leagueId });
  },

  /**
   * Get players in a league
   * @param {string} leagueId - The league ID
   * @returns {Promise<Array<{ id: string, name: string }>>}
   */
  async getPlayers(leagueId) {
    if (!convexClient) throw new Error('API not initialized');
    return await convexClient.query('players:list', { leagueId });
  },

  /**
   * Submit a score
   * @param {Object} params
   * @param {string} params.leagueId
   * @param {string} params.playerId
   * @param {'wordle' | 'connections'} params.game
   * @param {number} params.puzzleNum
   * @param {string} params.rawResult
   * @param {number} params.points
   * @returns {Promise<{ success: boolean, duplicate?: boolean }>}
   */
  async submitScore({ leagueId, playerId, game, puzzleNum, rawResult, points }) {
    if (!convexClient) throw new Error('API not initialized');
    return await convexClient.mutation('scores:submit', {
      leagueId,
      playerId,
      game,
      puzzleNum,
      rawResult,
      points
    });
  },

  /**
   * Get leaderboard for a league/game/period
   * @param {string} leagueId
   * @param {'wordle' | 'connections'} game
   * @param {'week' | 'month' | 'year' | 'all'} period
   * @returns {Promise<Array<{ playerId: string, playerName: string, totalPoints: number, gamesPlayed: number }>>}
   */
  async getLeaderboard(leagueId, game, period) {
    if (!convexClient) throw new Error('API not initialized');
    return await convexClient.query('scores:leaderboard', { leagueId, game, period });
  },

  /**
   * Subscribe to leaderboard updates
   * @param {string} leagueId
   * @param {'wordle' | 'connections'} game
   * @param {'week' | 'month' | 'year' | 'all'} period
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  subscribeLeaderboard(leagueId, game, period, callback) {
    if (!convexClient) throw new Error('API not initialized');
    return convexClient.onUpdate(
      'scores:leaderboard',
      { leagueId, game, period },
      callback
    );
  },

  /**
   * Get player's score history
   * @param {string} playerId
   * @param {'wordle' | 'connections'} game
   * @returns {Promise<Array<{ id: string, puzzleNum: number, rawResult: string, points: number, playedAt: number }>>}
   */
  async getPlayerHistory(playerId, game) {
    if (!convexClient) throw new Error('API not initialized');
    return await convexClient.query('scores:playerHistory', { playerId, game });
  },

  /**
   * Delete a score (admin only)
   * @param {string} scoreId
   * @param {string} adminPlayerId - The admin's player ID for verification
   * @returns {Promise<{ success: boolean }>}
   */
  async deleteScore(scoreId, adminPlayerId) {
    if (!convexClient) throw new Error('API not initialized');
    return await convexClient.mutation('scores:delete', { scoreId, adminPlayerId });
  },

  /**
   * Reassign a score to a different player (admin only)
   * @param {string} scoreId
   * @param {string} newPlayerId
   * @param {string} adminPlayerId - The admin's player ID for verification
   * @returns {Promise<{ success: boolean }>}
   */
  async reassignScore(scoreId, newPlayerId, adminPlayerId) {
    if (!convexClient) throw new Error('API not initialized');
    return await convexClient.mutation('scores:reassign', { scoreId, newPlayerId, adminPlayerId });
  }
};
