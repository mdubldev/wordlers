import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * List all players in a league
 */
export const list = query({
  args: {
    leagueId: v.id("leagues"),
  },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();

    return players.map((p) => ({
      id: p._id,
      name: p.name,
    }));
  },
});

/**
 * Get a single player by ID
 */
export const get = query({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) return null;

    return {
      id: player._id,
      name: player.name,
      leagueId: player.leagueId,
    };
  },
});
