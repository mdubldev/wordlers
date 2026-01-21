/**
 * Main application logic for Family Word League
 */
const app = {
  // Current state
  currentScreen: 'welcome',
  currentGame: 'wordle',
  currentPeriod: 'week',
  leaderboardUnsubscribe: null,

  // Created league data (temporary during creation flow)
  pendingLeague: null,

  // Current parsed score (for submission)
  parsedScore: null,

  /**
   * Initialize the application
   */
  async init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('Service worker registered');
      } catch (err) {
        console.warn('Service worker registration failed:', err);
      }
    }

    // Initialize Convex API
    // TODO: Replace with your Convex deployment URL
    const CONVEX_URL = window.CONVEX_URL || '';
    if (CONVEX_URL) {
      api.init(CONVEX_URL);
    }

    // Check for share target data
    const urlParams = new URLSearchParams(window.location.search);
    const shareText = urlParams.get('share') || urlParams.get('text');

    if (shareText && storage.hasIdentity()) {
      // Handle incoming share
      this.handleShareTarget(decodeURIComponent(shareText));
      // Clean URL
      window.history.replaceState({}, '', '/');
      return;
    }

    // Check if user has an identity
    if (storage.hasIdentity()) {
      this.showScreen('leaderboard');
      this.loadLeaderboard();
    } else {
      this.showScreen('welcome');
    }
  },

  /**
   * Show a screen by ID
   */
  showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // Show target screen
    const screen = document.getElementById(`screen-${screenId}`);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = screenId;
    }

    // Screen-specific setup
    if (screenId === 'leaderboard') {
      this.updateLeaderboardHeader();
    } else if (screenId === 'settings') {
      this.updateSettingsScreen();
    }
  },

  /**
   * Add a player input field
   */
  addPlayerInput() {
    const container = document.getElementById('player-inputs');
    const inputs = container.querySelectorAll('.player-input');

    if (inputs.length >= 8) {
      this.showToast('Maximum 8 players allowed');
      return;
    }

    const row = document.createElement('div');
    row.className = 'player-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-input';
    input.placeholder = `Player ${inputs.length + 1}`;
    input.required = true;
    input.maxLength = 30;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = () => this.removePlayerInput(removeBtn);

    row.appendChild(input);
    row.appendChild(removeBtn);
    container.appendChild(row);
  },

  removePlayerInput(button) {
    const container = document.getElementById('player-inputs');
    const rows = container.querySelectorAll('.player-row');

    if (rows.length <= 2) {
      this.showToast('Need at least 2 players');
      return;
    }

    const row = button.closest('.player-row');
    row.remove();

    // Update placeholder numbers
    const inputs = container.querySelectorAll('.player-input');
    inputs.forEach((input, index) => {
      input.placeholder = `Player ${index + 1}`;
    });
  },

  /**
   * Handle create league form submission
   */
  async handleCreateLeague(event) {
    event.preventDefault();

    const leagueName = document.getElementById('league-name').value.trim();
    const playerInputs = document.querySelectorAll('#player-inputs .player-input');
    const playerNames = Array.from(playerInputs)
      .map(input => input.value.trim())
      .filter(name => name.length > 0);

    if (playerNames.length < 2) {
      this.showToast('Need at least 2 players');
      return;
    }

    // Check for duplicate names
    const uniqueNames = new Set(playerNames.map(n => n.toLowerCase()));
    if (uniqueNames.size !== playerNames.length) {
      this.showToast('Player names must be unique');
      return;
    }

    if (!api.isReady()) {
      this.showToast('Not connected to server');
      return;
    }

    try {
      const result = await api.createLeague(leagueName, playerNames);

      // Store pending league for player selection
      this.pendingLeague = {
        leagueId: result.leagueId,
        name: leagueName,
        inviteCode: result.inviteCode,
        players: result.players
      };

      // Show invite code screen
      document.getElementById('invite-code-display').textContent = result.inviteCode;

      // Populate player selection
      const selectContainer = document.getElementById('player-select-create');
      selectContainer.innerHTML = result.players.map(player =>
        `<button class="player-select-btn" onclick="app.selectPlayer('${player.id}', '${player.name}', true)">${player.name}</button>`
      ).join('');

      this.showScreen('invite');
    } catch (err) {
      console.error('Create league error:', err);
      this.showToast('Failed to create league');
    }
  },

  /**
   * Handle join league form submission
   */
  async handleJoinLeague(event) {
    event.preventDefault();

    const inviteCode = document.getElementById('invite-code').value.trim().toUpperCase();

    if (!api.isReady()) {
      this.showToast('Not connected to server');
      return;
    }

    try {
      const result = await api.findLeague(inviteCode);

      if (!result) {
        this.showToast('League not found');
        return;
      }

      // Store pending league for player selection
      this.pendingLeague = {
        leagueId: result.leagueId,
        name: result.name,
        inviteCode: inviteCode,
        players: result.players
      };

      // Show league info
      document.getElementById('join-league-name').textContent = result.name;
      document.getElementById('join-league-result').classList.remove('hidden');

      // Populate player selection
      const selectContainer = document.getElementById('player-select-join');
      selectContainer.innerHTML = result.players.map(player =>
        `<button class="player-select-btn" onclick="app.selectPlayer('${player.id}', '${player.name}', false)">${player.name}</button>`
      ).join('');

    } catch (err) {
      console.error('Join league error:', err);
      this.showToast('Failed to find league');
    }
  },

  /**
   * Select player identity
   */
  selectPlayer(playerId, playerName, isCreator) {
    if (!this.pendingLeague) return;

    // Save identity
    storage.setIdentity(
      this.pendingLeague.leagueId,
      playerId,
      playerName,
      isCreator
    );

    // Clear pending data
    this.pendingLeague = null;

    // Go to leaderboard
    this.showScreen('leaderboard');
    this.loadLeaderboard();

    this.showToast(`Welcome, ${playerName}!`);
  },

  /**
   * Copy invite code to clipboard
   */
  async copyInviteCode() {
    const code = document.getElementById('invite-code-display').textContent;
    try {
      await navigator.clipboard.writeText(code);
      this.showToast('Code copied!');
    } catch (err) {
      this.showToast('Could not copy');
    }
  },

  /**
   * Update leaderboard header with league name
   */
  async updateLeaderboardHeader() {
    const leagueId = storage.getLeagueId();
    if (!leagueId || !api.isReady()) return;

    try {
      const league = await api.getLeague(leagueId);
      document.getElementById('league-title').textContent = league.name;
    } catch (err) {
      console.error('Get league error:', err);
    }
  },

  /**
   * Set current game filter
   */
  setGame(game) {
    this.currentGame = game;

    // Update tab styles
    document.querySelectorAll('.game-tabs .tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.game === game);
    });

    this.loadLeaderboard();
  },

  /**
   * Set current period filter
   */
  setPeriod(period) {
    this.currentPeriod = period;

    // Update filter styles
    document.querySelectorAll('.period-filters .filter').forEach(filter => {
      filter.classList.toggle('active', filter.dataset.period === period);
    });

    this.loadLeaderboard();
  },

  /**
   * Load and display leaderboard
   */
  async loadLeaderboard() {
    const leagueId = storage.getLeagueId();
    const currentPlayerId = storage.getPlayerId();
    if (!leagueId || !api.isReady()) return;

    const container = document.getElementById('leaderboard-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      const leaderboard = await api.getLeaderboard(leagueId, this.currentGame, this.currentPeriod);

      if (leaderboard.length === 0) {
        container.innerHTML = '<div class="empty-state">No scores yet. Be the first!</div>';
        return;
      }

      container.innerHTML = leaderboard.map((player, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const isCurrentUser = player.playerId === currentPlayerId;

        return `
          <div class="player-card ${isCurrentUser ? 'current-user' : ''}" onclick="app.showPlayerHistory('${player.playerId}', '${player.playerName}')">
            <div class="player-rank ${rankClass}">${rank}</div>
            <div class="player-info">
              <div class="player-name">${player.playerName}</div>
              <div class="player-games">${player.gamesPlayed} ${player.gamesPlayed === 1 ? 'game' : 'games'}</div>
            </div>
            <div class="player-points">${player.totalPoints}</div>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Load leaderboard error:', err);
      container.innerHTML = '<div class="empty-state">Failed to load leaderboard</div>';
    }
  },

  /**
   * Show player history modal
   */
  async showPlayerHistory(playerId, playerName) {
    document.getElementById('history-player-name').textContent = playerName;

    const container = document.getElementById('history-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    this.showScreen('history');

    if (!api.isReady()) return;

    try {
      const history = await api.getPlayerHistory(playerId, this.currentGame);
      const isAdmin = storage.isAdmin();
      const players = await api.getPlayers(storage.getLeagueId());

      if (history.length === 0) {
        container.innerHTML = '<div class="empty-state">No scores yet</div>';
        return;
      }

      container.innerHTML = history.map(score => {
        const adminActions = isAdmin ? `
          <div class="history-actions">
            <button onclick="event.stopPropagation(); app.showReassignModal('${score.id}', '${playerId}')" title="Reassign">&#8644;</button>
            <button class="delete" onclick="event.stopPropagation(); app.confirmDeleteScore('${score.id}')" title="Delete">&times;</button>
          </div>
        ` : '';

        return `
          <div class="history-item">
            <div class="history-puzzle">#${score.puzzleNum}</div>
            <div class="history-result">${score.rawResult}</div>
            <div class="history-points">${score.points}</div>
            ${adminActions}
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Load history error:', err);
      container.innerHTML = '<div class="empty-state">Failed to load history</div>';
    }
  },

  /**
   * Preview score from manual entry
   */
  previewScore() {
    const text = document.getElementById('score-input').value;
    const preview = document.getElementById('score-preview');
    const submitBtn = document.getElementById('submit-score-btn');

    const parsed = parser.parse(text);

    if (!parsed) {
      preview.classList.add('hidden');
      submitBtn.disabled = true;
      this.parsedScore = null;
      return;
    }

    this.parsedScore = parsed;

    document.getElementById('preview-game').textContent = parsed.game === 'wordle' ? 'Wordle' : 'Connections';
    document.getElementById('preview-puzzle').textContent = `#${parsed.puzzleNum}`;
    document.getElementById('preview-points').textContent = `${parsed.points} ${parsed.points === 1 ? 'point' : 'points'}`;
    document.getElementById('preview-breakdown').textContent = parser.getPointsBreakdown(parsed);

    preview.classList.remove('hidden');
    submitBtn.disabled = false;
  },

  /**
   * Submit score from manual entry
   */
  async submitScore() {
    if (!this.parsedScore) return;

    const leagueId = storage.getLeagueId();
    const playerId = storage.getPlayerId();

    if (!leagueId || !playerId || !api.isReady()) {
      this.showToast('Not logged in');
      return;
    }

    try {
      const result = await api.submitScore({
        leagueId,
        playerId,
        game: this.parsedScore.game,
        puzzleNum: this.parsedScore.puzzleNum,
        rawResult: this.parsedScore.rawResult,
        points: this.parsedScore.points
      });

      if (result.duplicate) {
        // Silent for share target, show message for manual
        if (this.currentScreen === 'submit') {
          this.showToast('Already submitted this puzzle');
        }
        return;
      }

      // Clear form
      document.getElementById('score-input').value = '';
      document.getElementById('score-preview').classList.add('hidden');
      document.getElementById('submit-score-btn').disabled = true;
      this.parsedScore = null;

      this.showToast('Score submitted!');
      this.showScreen('leaderboard');
      this.loadLeaderboard();

    } catch (err) {
      console.error('Submit score error:', err);
      this.showToast('Failed to submit score');
    }
  },

  /**
   * Handle incoming share target data
   */
  async handleShareTarget(text) {
    const parsed = parser.parse(text);

    if (!parsed) {
      this.showToast('Could not parse score');
      this.showScreen('leaderboard');
      this.loadLeaderboard();
      return;
    }

    const leagueId = storage.getLeagueId();
    const playerId = storage.getPlayerId();

    if (!leagueId || !playerId || !api.isReady()) {
      this.showScreen('leaderboard');
      return;
    }

    try {
      const result = await api.submitScore({
        leagueId,
        playerId,
        game: parsed.game,
        puzzleNum: parsed.puzzleNum,
        rawResult: parsed.rawResult,
        points: parsed.points
      });

      if (!result.duplicate) {
        this.showToast(`${parsed.points} ${parsed.points === 1 ? 'point' : 'points'} added!`);
      }
      // Silent if duplicate (as per requirements)

      this.showScreen('leaderboard');
      this.setGame(parsed.game);
      this.loadLeaderboard();

    } catch (err) {
      console.error('Share target submit error:', err);
      this.showScreen('leaderboard');
      this.loadLeaderboard();
    }
  },

  /**
   * Update settings screen with current values
   */
  async updateSettingsScreen() {
    document.getElementById('current-player-name').textContent = storage.getPlayerName() || '-';

    const leagueId = storage.getLeagueId();
    if (!leagueId || !api.isReady()) return;

    try {
      const league = await api.getLeague(leagueId);
      document.getElementById('settings-league-name').textContent = league.name;
      document.getElementById('settings-invite-code').textContent = league.inviteCode;
    } catch (err) {
      console.error('Get league error:', err);
    }
  },

  /**
   * Show player switch modal
   */
  async showPlayerSwitch() {
    const leagueId = storage.getLeagueId();
    const currentPlayerId = storage.getPlayerId();

    if (!leagueId || !api.isReady()) return;

    try {
      const players = await api.getPlayers(leagueId);

      const container = document.getElementById('player-switch-list');
      container.innerHTML = players.map(player => {
        const isCurrent = player.id === currentPlayerId;
        return `<button class="player-select-btn ${isCurrent ? 'current' : ''}" ${isCurrent ? 'disabled' : ''} onclick="app.switchPlayer('${player.id}', '${player.name}')">${player.name}${isCurrent ? ' (you)' : ''}</button>`;
      }).join('');

      document.getElementById('modal-player-switch').classList.remove('hidden');

    } catch (err) {
      console.error('Get players error:', err);
      this.showToast('Failed to load players');
    }
  },

  /**
   * Hide player switch modal
   */
  hidePlayerSwitch() {
    document.getElementById('modal-player-switch').classList.add('hidden');
  },

  /**
   * Switch to a different player
   */
  switchPlayer(playerId, playerName) {
    storage.switchPlayer(playerId, playerName);
    this.hidePlayerSwitch();
    this.updateSettingsScreen();
    this.showToast(`Switched to ${playerName}`);
  },

  /**
   * Share league invite
   */
  async shareLeague() {
    const leagueId = storage.getLeagueId();
    if (!leagueId || !api.isReady()) return;

    try {
      const league = await api.getLeague(leagueId);
      const shareText = `Join my Word League "${league.name}"! Use code: ${league.inviteCode}`;

      if (navigator.share) {
        await navigator.share({
          title: 'Family Word League',
          text: shareText
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        this.showToast('Invite copied!');
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  },

  /**
   * Leave the current league
   */
  leaveLeague() {
    if (confirm('Are you sure you want to leave this league? You can rejoin with the invite code.')) {
      storage.clear();
      this.showScreen('welcome');
      this.showToast('Left league');
    }
  },

  /**
   * Confirm and delete a score (admin only)
   */
  async confirmDeleteScore(scoreId) {
    if (!confirm('Delete this score?')) return;

    if (!api.isReady()) return;

    try {
      await api.deleteScore(scoreId, storage.getPlayerId());
      this.showToast('Score deleted');
      // Refresh current view
      this.showScreen('leaderboard');
      this.loadLeaderboard();
    } catch (err) {
      console.error('Delete score error:', err);
      this.showToast('Failed to delete');
    }
  },

  /**
   * Show reassign modal (admin only)
   * TODO: Implement reassign modal UI
   */
  showReassignModal(scoreId, currentPlayerId) {
    this.showToast('Reassign coming soon');
  },

  /**
   * Show a toast notification
   */
  showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => app.init());
