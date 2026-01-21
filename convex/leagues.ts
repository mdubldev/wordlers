import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Generate a random invite code (8 uppercase alphanumeric characters)
 */
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars (0, O, 1, I)
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a new league with players
 */
export const create = mutation({
  args: {
    name: v.string(),
    playerNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await ctx.db
        .query("leagues")
        .withIndex("by_invite_code", (q) => q.eq("inviteCode", inviteCode))
        .first();
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Create league
    const leagueId = await ctx.db.insert("leagues", {
      name: args.name.trim(),
      inviteCode,
      createdAt: Date.now(),
    });

    // Create players
    const players = [];
    for (const name of args.playerNames) {
      const playerId = await ctx.db.insert("players", {
        leagueId,
        name: name.trim(),
        createdAt: Date.now(),
      });
      players.push({ id: playerId, name: name.trim() });
    }

    // Set first player as creator (will be updated when they select identity)
    // For now, we'll track this when they actually choose

    return {
      leagueId,
      inviteCode,
      players,
    };
  },
});

/**
 * Find a league by invite code
 */
export const findByCode = query({
  args: {
    inviteCode: v.string(),
  },
  handler: async (ctx, args) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_invite_code", (q) =>
        q.eq("inviteCode", args.inviteCode.toUpperCase())
      )
      .first();

    if (!league) return null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .collect();

    return {
      leagueId: league._id,
      name: league.name,
      players: players.map((p) => ({ id: p._id, name: p.name })),
    };
  },
});

/**
 * Get league info by ID
 */
export const get = query({
  args: {
    leagueId: v.id("leagues"),
  },
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league) throw new Error("League not found");

    return {
      name: league.name,
      inviteCode: league.inviteCode,
      creatorPlayerId: league.creatorPlayerId ?? null,
    };
  },
});

/**
 * Set the league creator (called when first player selects identity)
 */
export const setCreator = mutation({
  args: {
    leagueId: v.id("leagues"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league) throw new Error("League not found");

    // Only set if not already set
    if (!league.creatorPlayerId) {
      await ctx.db.patch(args.leagueId, {
        creatorPlayerId: args.playerId,
      });
    }
  },
});
