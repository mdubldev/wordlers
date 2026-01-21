import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get start timestamp for a period (using device-local time assumption)
 * Since we can't know the user's timezone on the server, we'll use UTC
 * and let the client handle timezone display
 */
function getPeriodStart(period: "week" | "month" | "year" | "all"): number {
  if (period === "all") return 0;

  const now = new Date();

  if (period === "week") {
    // Start of current week (Monday)
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1; // Adjust so Monday is start
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - diff);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.getTime();
  }

  if (period === "month") {
    // Start of current month
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    return startOfMonth.getTime();
  }

  if (period === "year") {
    // Start of current year
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return startOfYear.getTime();
  }

  return 0;
}

/**
 * Submit a score
 */
export const submit = mutation({
  args: {
    leagueId: v.id("leagues"),
    playerId: v.id("players"),
    game: v.union(v.literal("wordle"), v.literal("connections")),
    puzzleNum: v.number(),
    rawResult: v.string(),
    points: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate (same player, game, puzzle)
    const existing = await ctx.db
      .query("scores")
      .withIndex("by_player_game_puzzle", (q) =>
        q
          .eq("playerId", args.playerId)
          .eq("game", args.game)
          .eq("puzzleNum", args.puzzleNum)
      )
      .first();

    if (existing) {
      return { success: true, duplicate: true };
    }

    // Insert score
    await ctx.db.insert("scores", {
      leagueId: args.leagueId,
      playerId: args.playerId,
      game: args.game,
      puzzleNum: args.puzzleNum,
      rawResult: args.rawResult,
      points: args.points,
      playedAt: Date.now(),
    });

    return { success: true, duplicate: false };
  },
});

/**
 * Get leaderboard for a league/game/period
 */
export const leaderboard = query({
  args: {
    leagueId: v.id("leagues"),
    game: v.union(v.literal("wordle"), v.literal("connections")),
    period: v.union(
      v.literal("week"),
      v.literal("month"),
      v.literal("year"),
      v.literal("all")
    ),
  },
  handler: async (ctx, args) => {
    const periodStart = getPeriodStart(args.period);

    // Get all scores for this league and game
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_league_game", (q) =>
        q.eq("leagueId", args.leagueId).eq("game", args.game)
      )
      .filter((q) => q.gte(q.field("playedAt"), periodStart))
      .collect();

    // Get all players in the league
    const players = await ctx.db
      .query("players")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();

    // Aggregate by player
    const playerStats: Record<
      string,
      { playerName: string; totalPoints: number; gamesPlayed: number }
    > = {};

    for (const player of players) {
      playerStats[player._id] = {
        playerName: player.name,
        totalPoints: 0,
        gamesPlayed: 0,
      };
    }

    for (const score of scores) {
      const playerId = score.playerId;
      if (playerStats[playerId]) {
        playerStats[playerId].totalPoints += score.points;
        playerStats[playerId].gamesPlayed += 1;
      }
    }

    // Convert to array and sort by total points (descending)
    const leaderboard = Object.entries(playerStats)
      .map(([playerId, stats]) => ({
        playerId,
        ...stats,
      }))
      .sort((a, b) => {
        // Primary sort: total points (descending)
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        // Secondary sort: games played (descending) for tiebreaker
        return b.gamesPlayed - a.gamesPlayed;
      });

    return leaderboard;
  },
});

/**
 * Get a player's score history for a game
 */
export const playerHistory = query({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("wordle"), v.literal("connections")),
  },
  handler: async (ctx, args) => {
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_player_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .order("desc")
      .collect();

    return scores.map((score) => ({
      id: score._id,
      puzzleNum: score.puzzleNum,
      rawResult: score.rawResult,
      points: score.points,
      playedAt: score.playedAt,
    }));
  },
});

/**
 * Delete a score (admin only)
 */
export const deleteScore = mutation({
  args: {
    scoreId: v.id("scores"),
    adminPlayerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    // Get the score to find its league
    const score = await ctx.db.get(args.scoreId);
    if (!score) {
      return { success: false, error: "Score not found" };
    }

    // Verify admin is the league creator
    const league = await ctx.db.get(score.leagueId);
    if (!league) {
      return { success: false, error: "League not found" };
    }

    if (league.creatorPlayerId !== args.adminPlayerId) {
      return { success: false, error: "Not authorized" };
    }

    // Delete the score
    await ctx.db.delete(args.scoreId);

    return { success: true };
  },
});

/**
 * Reassign a score to a different player (admin only)
 */
export const reassign = mutation({
  args: {
    scoreId: v.id("scores"),
    newPlayerId: v.id("players"),
    adminPlayerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    // Get the score
    const score = await ctx.db.get(args.scoreId);
    if (!score) {
      return { success: false, error: "Score not found" };
    }

    // Verify admin is the league creator
    const league = await ctx.db.get(score.leagueId);
    if (!league) {
      return { success: false, error: "League not found" };
    }

    if (league.creatorPlayerId !== args.adminPlayerId) {
      return { success: false, error: "Not authorized" };
    }

    // Verify new player is in the same league
    const newPlayer = await ctx.db.get(args.newPlayerId);
    if (!newPlayer || newPlayer.leagueId !== score.leagueId) {
      return { success: false, error: "Invalid player" };
    }

    // Check if new player already has this puzzle
    const existing = await ctx.db
      .query("scores")
      .withIndex("by_player_game_puzzle", (q) =>
        q
          .eq("playerId", args.newPlayerId)
          .eq("game", score.game)
          .eq("puzzleNum", score.puzzleNum)
      )
      .first();

    if (existing) {
      return { success: false, error: "Player already has this puzzle" };
    }

    // Update the score
    await ctx.db.patch(args.scoreId, {
      playerId: args.newPlayerId,
    });

    return { success: true };
  },
});
