import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  leagues: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    creatorPlayerId: v.optional(v.id("players")),
    createdAt: v.number(),
  }).index("by_invite_code", ["inviteCode"]),

  players: defineTable({
    leagueId: v.id("leagues"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_league", ["leagueId"]),

  scores: defineTable({
    leagueId: v.id("leagues"),
    playerId: v.id("players"),
    game: v.union(v.literal("wordle"), v.literal("connections")),
    puzzleNum: v.number(),
    rawResult: v.string(),
    points: v.number(),
    playedAt: v.number(),
  })
    .index("by_league_game", ["leagueId", "game"])
    .index("by_player_game", ["playerId", "game"])
    .index("by_player_game_puzzle", ["playerId", "game", "puzzleNum"]),
});
