/**
 * Parser for Wordle and Connections share text
 */
const parser = {
  /**
   * Detect game type from share text
   * @param {string} text - The shared text
   * @returns {'wordle' | 'connections' | null}
   */
  detectGame(text) {
    if (!text) return null;
    const normalized = text.toLowerCase();
    if (normalized.includes('wordle')) return 'wordle';
    if (normalized.includes('connections')) return 'connections';
    return null;
  },

  /**
   * Parse Wordle share text
   * @param {string} text - The shared text
   * @returns {{ game: 'wordle', puzzleNum: number, guesses: number | 'X', points: number, rawResult: string } | null}
   *
   * Example input:
   * Wordle 1,284 4/6
   *
   * ⬛⬛🟨⬛⬛
   * ⬛🟩⬛🟩⬛
   * 🟩🟩⬛🟩⬛
   * 🟩🟩🟩🟩🟩
   */
  parseWordle(text) {
    if (!text) return null;

    // Match "Wordle X,XXX N/6" or "Wordle XXXX N/6"
    // Handle optional comma in number, and X for failed
    const headerMatch = text.match(/wordle\s+([\d,]+)\s+([1-6X])\/6/i);
    if (!headerMatch) return null;

    const puzzleNum = parseInt(headerMatch[1].replace(/,/g, ''), 10);
    const guessesRaw = headerMatch[2].toUpperCase();
    const guesses = guessesRaw === 'X' ? 'X' : parseInt(guessesRaw, 10);

    // Calculate points: fewer guesses = more points
    // 1/6 = 6 points, 2/6 = 5 points, ..., 6/6 = 1 point, X/6 = 0 points
    let points = 0;
    if (guesses !== 'X') {
      points = 7 - guesses;
    }

    // Extract the emoji grid for display
    const lines = text.trim().split('\n');
    const emojiLines = lines.filter(line =>
      /[⬛⬜🟨🟩🟧🟦]/.test(line)
    );
    const rawResult = `${guesses}/6`;

    return {
      game: 'wordle',
      puzzleNum,
      guesses,
      points,
      rawResult,
      emojiGrid: emojiLines.join('\n')
    };
  },

  /**
   * Parse Connections share text
   * @param {string} text - The shared text
   * @returns {{ game: 'connections', puzzleNum: number, solveOrder: string[], points: number, rawResult: string, completed: boolean } | null}
   *
   * Example input:
   * Connections
   * Puzzle #567
   * 🟪🟪🟪🟪
   * 🟦🟦🟦🟦
   * 🟩🟩🟩🟩
   * 🟨🟨🟨🟨
   */
  parseConnections(text) {
    if (!text) return null;

    // Match puzzle number
    const puzzleMatch = text.match(/puzzle\s*#?\s*(\d+)/i);
    if (!puzzleMatch) return null;

    const puzzleNum = parseInt(puzzleMatch[1], 10);

    // Define color mappings
    const colorMap = {
      '🟪': 'purple',
      '🟣': 'purple',
      '🟦': 'blue',
      '🔵': 'blue',
      '🟩': 'green',
      '🟢': 'green',
      '🟨': 'yellow',
      '🟡': 'yellow'
    };

    // Parse emoji grid to determine solve order
    const lines = text.trim().split('\n');
    const solveOrder = [];
    const emojiLines = [];

    for (const line of lines) {
      // Check if line is a complete row (4 matching colored squares)
      const emojis = [...line].filter(char => colorMap[char]);

      if (emojis.length === 4) {
        // Check if all 4 are the same color
        const colors = emojis.map(e => colorMap[e]);
        const uniqueColors = [...new Set(colors)];

        if (uniqueColors.length === 1) {
          // This is a successfully guessed group
          solveOrder.push(uniqueColors[0]);
          emojiLines.push(line.trim());
        } else {
          // This is a failed guess (mixed colors) - still record the line
          emojiLines.push(line.trim());
        }
      }
    }

    // Determine if puzzle was completed (all 4 groups found)
    const completed = solveOrder.length === 4;

    // Calculate points
    let points = 0;
    const noMistakes = emojiLines.length === 4;

    if (completed) {
      points = 1; // Base point for completing

      // Bonus for no mistakes (exactly 4 guesses)
      if (noMistakes) {
        points += 1;
      }

      // Bonus for getting purple (hardest) first
      if (solveOrder[0] === 'purple') {
        points += 1;
      }

      // Bonus for perfect reverse order (purple → blue → green → yellow)
      // Only awarded if completed with no mistakes
      const perfectOrder = ['purple', 'blue', 'green', 'yellow'];
      const isPerfectOrder = solveOrder.every((color, i) => color === perfectOrder[i]);
      if (isPerfectOrder && noMistakes) {
        points += 1;
      }
    }

    // Build breakdown description
    let breakdown = [];
    if (completed) {
      breakdown.push('Completed (+1)');
      if (noMistakes) {
        breakdown.push('No mistakes (+1)');
      }
      if (solveOrder[0] === 'purple') {
        breakdown.push('Purple first (+1)');
      }
      const perfectOrder = ['purple', 'blue', 'green', 'yellow'];
      if (solveOrder.every((color, i) => color === perfectOrder[i]) && noMistakes) {
        breakdown.push('Perfect order (+1)');
      }
    } else {
      breakdown.push(`Incomplete (${solveOrder.length}/4 groups)`);
    }

    return {
      game: 'connections',
      puzzleNum,
      solveOrder,
      points,
      completed,
      rawResult: completed ? solveOrder.join(' → ') : `${solveOrder.length}/4`,
      breakdown: breakdown.join(', '),
      emojiGrid: emojiLines.join('\n'),
      totalGuesses: emojiLines.length
    };
  },

  /**
   * Parse any game share text
   * @param {string} text - The shared text
   * @returns {Object | null} Parsed result or null if unrecognized
   */
  parse(text) {
    const game = this.detectGame(text);
    if (!game) return null;

    if (game === 'wordle') {
      return this.parseWordle(text);
    } else if (game === 'connections') {
      return this.parseConnections(text);
    }

    return null;
  },

  /**
   * Get a human-readable breakdown of points for display
   * @param {Object} parsed - The parsed result
   * @returns {string}
   */
  getPointsBreakdown(parsed) {
    if (!parsed) return '';

    if (parsed.game === 'wordle') {
      if (parsed.guesses === 'X') {
        return 'Failed to solve';
      }
      return `Solved in ${parsed.guesses} ${parsed.guesses === 1 ? 'guess' : 'guesses'}`;
    }

    if (parsed.game === 'connections') {
      return parsed.breakdown || '';
    }

    return '';
  }
};
