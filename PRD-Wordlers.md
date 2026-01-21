# Product Requirements Document: Family Word League

## Overview

**Product name:** Family Word League

**One-liner:** A mobile PWA that tracks Wordle and Connections scores across a group, with rolling leaderboards and period-based champions.

**Origin:** A family of 4 plays Wordle and Connections daily, sharing results in WhatsApp. This app formalises the competition with persistent score tracking and league tables.

**Scale:** Initially for personal use. Designed to support multiple private leagues for friends/acquaintances who discover it, but no marketing or public growth intended.

---

## Problem Statement

Sharing daily puzzle scores in a group chat is fun but ephemeral. There's no easy way to:

- Track cumulative performance over time
- Crown weekly, monthly, or yearly champions
- Add gamification (bonus points for Connections solve order)
- See historical results

---

## Solution

A lightweight PWA that:

1. Receives shared scores directly from Wordle/Connections via the **Web Share Target API**
2. Parses the emoji grid automatically
3. Calculates points based on custom scoring rules
4. Maintains per-player, per-game leaderboards
5. Supports multiple independent leagues

---

## Target Users

- Small groups (2-8 people) who play NYT word games daily
- Non-technical users who need a frictionless experience
- Mobile-first (iOS and Android)

---

## Core User Flows

### 1. Create a League

```
User visits app for first time
  → Taps "Create a League"
  → Enters league name (e.g., "The Smiths")
  → Adds player names (e.g., "Mum", "Dad", "Alex", "Sam")
  → Receives invite code (e.g., "SMITHS2024")
  → Shares code with group via WhatsApp/text
  → Selects "I am [name]" to set their identity
  → Identity stored locally on device
```

### 2. Join a League

```
User receives invite code from friend/family
  → Visits app
  → Taps "Join a League"
  → Enters invite code
  → Sees league name and player list
  → Selects "I am [name]"
  → Identity stored locally on device
```

### 3. Submit Score (Share Target - Primary)

```
User completes Wordle/Connections
  → Taps Share in NYT Games app
  → Selects "Family Word League" from share sheet
  → App opens, parses score automatically
  → Shows points earned and breakdown
  → Confirms submission (or auto-submits if preferred)
  → Score saved to their remembered identity
```

### 4. Submit Score (Manual Paste - Fallback)

```
User copies result from Wordle/Connections
  → Opens Family Word League app
  → Navigates to manual entry
  → Pastes emoji grid
  → App parses and shows points
  → Taps "Submit"
  → Score saved to their remembered identity
```

### 5. View Leaderboard

```
User opens app
  → Sees leaderboard for default game (Wordle)
  → Can toggle between Wordle and Connections
  → Can filter by period: This Week / This Month / This Year / All Time
  → Taps a player to see their score history
```

### 6. Switch Player (Edge Case)

```
User is on a shared device or set up incorrectly
  → Goes to Settings
  → Taps "I'm not [name]"
  → Selects correct player
  → Identity updated locally
```

---

## Scoring Rules

### Wordle

Points awarded based on number of guesses (fewer = better):

| Result | Points |
|--------|--------|
| 1/6    | 6      |
| 2/6    | 5      |
| 3/6    | 4      |
| 4/6    | 3      |
| 5/6    | 2      |
| 6/6    | 1      |
| X/6    | 0      |

### Connections

Points awarded based on solve order (harder groups first = better):

| Achievement | Points |
|-------------|--------|
| Completed the puzzle | 1 |
| Got purple (hardest) group first | +1 bonus |
| Perfect reverse order (purple → blue → green → yellow) | +1 bonus |
| **Maximum possible** | **3** |
| Failed to complete | 0 |

**Parsing logic:** The app examines successful guess rows (4 matching emojis) and determines the order in which colour groups were solved.

---

## Technical Architecture

### Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Static HTML/CSS/JS | Simple, no build step, fast loading |
| Backend | Convex | Real-time sync, TypeScript functions, generous free tier |
| Hosting | Netlify or Vercel | Free static hosting with HTTPS |
| Database | Convex (built-in) | Handles storage, queries, real-time subscriptions |

### PWA Requirements

The app must be a Progressive Web App to enable:

- **Web Share Target API** - appear in native share sheet
- **Offline support** - cached assets via service worker
- **Install prompt** - "Add to Home Screen"
- **Persistent localStorage** - exempt from Safari 7-day eviction when installed

### Data Model

```typescript
// leagues
{
  _id: Id<"leagues">,
  name: string,              // "The Smiths"
  inviteCode: string,        // "SMITHS2024" (unique, 8 chars)
  createdAt: number,         // timestamp
}

// players
{
  _id: Id<"players">,
  leagueId: Id<"leagues">,
  name: string,              // "Mum"
  createdAt: number,
}

// scores
{
  _id: Id<"scores">,
  leagueId: Id<"leagues">,
  playerId: Id<"players">,
  game: "wordle" | "connections",
  puzzleNum: number,         // 1284
  score: string,             // "3/6" or "🟪 first + perfect order"
  points: number,            // 4
  playedAt: number,          // timestamp
}
```

### Convex Functions

| Function | Purpose |
|----------|---------|
| `createLeague(name, playerNames)` | Create league, generate invite code, create players |
| `joinLeague(inviteCode)` | Validate code, return league info and players |
| `submitScore(playerId, gameData)` | Validate no duplicate, insert score |
| `getLeaderboard(leagueId, game, period)` | Aggregate points, return ranked players |
| `getPlayerHistory(playerId, game)` | Return player's score history |
| `deleteScore(scoreId)` | Remove erroneous score (league admin) |
| `reassignScore(scoreId, newPlayerId)` | Fix misattributed score |

### Local Storage Schema

```javascript
{
  leagueId: "abc123",        // Convex league ID
  playerId: "xyz789",        // Convex player ID  
  playerName: "Mum",         // Display name (for UI)
}
```

---

## User Identity & Authentication

**Approach:** No authentication. Identity is established per-device via localStorage.

**Rationale:**
- Target users are trusted groups (family/friends)
- Eliminates friction of login flows
- No sensitive data (just puzzle numbers and points)
- Abuse vector is low (unmarketed, invite-only leagues)

**How it works:**
1. First visit: User selects "I am [name]" from the league's player list
2. Choice stored in localStorage
3. All subsequent score submissions auto-assign to that player
4. Settings allows switching player if needed

**Edge cases:**
- Shared device: User must switch identity in settings before submitting
- New phone: User re-selects identity once (acceptable friction)
- Cheating: Socially enforced ("Why did you submit my score, Dad?")

---

## Leaderboard Periods

Users can filter the leaderboard by:

| Period | Definition |
|--------|------------|
| This Week | Monday 00:00 → Sunday 23:59 (current week) |
| This Month | 1st → last day of current month |
| This Year | Jan 1 → Dec 31 of current year |
| All Time | All recorded scores |

**Champion recognition:** The #1 ranked player for each completed period could be highlighted or badged (stretch goal).

---

## Screens

### 1. Welcome / Onboarding
- "Create a League" button
- "Join a League" button

### 2. Create League
- League name input
- Player names input (add/remove)
- "Create" button → shows invite code

### 3. Join League
- Invite code input
- Shows league name and players on valid code
- "I am [name]" selection

### 4. Main Leaderboard
- Game toggle: Wordle / Connections
- Period filter: Week / Month / Year / All Time
- Ranked player cards showing total points and games played
- Tap player → history modal

### 5. Player History Modal
- List of scores for selected player/game
- Puzzle number, result, points earned
- Option to delete or reassign (if league admin - stretch)

### 6. Manual Entry
- Paste area for emoji grid
- Parsed result preview with points
- Submit button

### 7. Share Target Receiver
- Auto-parsed score display
- Points breakdown
- Confirm/submit button

### 8. Settings
- Current identity display with "Switch player" option
- League info (name, invite code for sharing)
- Player management (add/rename - stretch)
- "Leave league" option
- Reset/clear data

---

## Platform Support

| Platform | Share Target | PWA Install | Notes |
|----------|--------------|-------------|-------|
| Android + Chrome | ✅ | ✅ | Best experience |
| iOS + Safari | ✅ (iOS 15+) | ✅ | Slightly quirky but works |
| Desktop Chrome | Limited | ✅ | Share Target less useful on desktop |

**Primary target:** Mobile (Android & iOS)

---

## Non-Goals (Out of Scope)

- User accounts / authentication
- Email notifications
- Push notifications  
- Public leagues / discovery
- Monetisation
- Social features (comments, reactions)
- Other games beyond Wordle & Connections
- Historical data import

---

## Future Considerations (Stretch Goals)

If usage grows organically:

- **Badges/achievements** (e.g., "First purple 5 times in a row")
- **Weekly recap** (shareable image for WhatsApp)
- **Streak tracking** (consecutive days played)
- **Head-to-head stats** ("Mum beats Dad 60% of the time")
- **League admin role** (manage players, fix scores)
- **More NYT games** (Strands, Spelling Bee)

---

## Success Criteria

For personal/family use:

- [ ] All 4 family members successfully submit scores via Share Target
- [ ] Leaderboard updates in real-time when anyone submits
- [ ] Weekly champion is clear and accurate
- [ ] App feels faster than checking WhatsApp chat history

For wider use:

- [ ] A friend successfully creates their own league using just the invite flow
- [ ] No intervention needed from the developer

---

## Open Questions

1. **Auto-submit vs confirm?** Should Share Target submissions require a confirm tap, or just flash "Saved!" and close? (Recommend: confirm for first few weeks, then consider auto-submit)

2. **Duplicate puzzle handling?** If someone submits the same puzzle twice, reject silently or show error? (Recommend: show friendly error "You've already submitted Wordle #1284")

3. **Time zones for periods?** Use device local time or a fixed timezone for the league? (Recommend: device local time for simplicity)

4. **Admin controls?** Should the league creator have special powers (delete scores, remove players)? (Recommend: yes, minimal - delete/reassign scores only)

---

## Appendix: Share Text Formats

### Wordle

```
Wordle 1,284 4/6

⬛⬛🟨⬛⬛
⬛🟩⬛🟩⬛
🟩🟩⬛🟩⬛
🟩🟩🟩🟩🟩
```

Parse: Extract "4" from "4/6" → 3 points

### Connections

```
Connections
Puzzle #567
🟪🟪🟪🟪
🟦🟦🟦🟦
🟩🟩🟩🟩
🟨🟨🟨🟨
```

Parse: Identify successful rows in order (purple, blue, green, yellow) → 3 points (completed + purple first + perfect order)
