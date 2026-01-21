# Family Word League

A mobile PWA for tracking Wordle and Connections scores across family/friend groups with rolling leaderboards and period-based champions.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Convex

Create a Convex account at [convex.dev](https://convex.dev) and create a new project.

```bash
npx convex dev
```

This will:
- Prompt you to log in to Convex
- Create a new project (or link to existing)
- Deploy your schema and functions
- Give you your deployment URL

### 3. Configure the Frontend

After running `convex dev`, you'll get a deployment URL like:
```
https://your-project-123.convex.cloud
```

Add this to `index.html` before the other scripts:
```html
<script>
  window.CONVEX_URL = 'https://your-project-123.convex.cloud';
</script>
```

### 4. Generate PWA Icons

Convert the SVG icon to PNG:
```bash
# Using ImageMagick
convert icons/icon.svg -resize 192x192 icons/icon-192.png
convert icons/icon.svg -resize 512x512 icons/icon-512.png

# Or use an online SVG to PNG converter
```

### 5. Local Development

Serve the static files locally:
```bash
npx serve .
```

Or use any static file server of your choice.

### 6. Deploy to Netlify

1. Push your code to GitHub
2. Connect the repo to Netlify
3. Build settings are already configured in `netlify.toml`
4. Deploy!

**Important:** Make sure to update `CONVEX_URL` with your production Convex URL.

## Project Structure

```
/
├── index.html          # Main app (all screens)
├── manifest.json       # PWA manifest with Share Target
├── sw.js               # Service worker for offline support
├── netlify.toml        # Netlify configuration
├── package.json        # Dependencies (Convex)
├── css/
│   └── styles.css      # All styling
├── js/
│   ├── app.js          # Main application logic
│   ├── parser.js       # Wordle/Connections parsing
│   ├── storage.js      # localStorage wrapper
│   └── api.js          # Convex client wrapper
├── convex/
│   ├── schema.ts       # Database schema
│   ├── leagues.ts      # League mutations/queries
│   ├── players.ts      # Player queries
│   └── scores.ts       # Score mutations/queries
└── icons/
    └── icon.svg        # App icon (convert to PNG)
```

## Features

- **Share Target API** - Submit scores directly from Wordle/Connections share button
- **Real-time Leaderboards** - Powered by Convex subscriptions
- **Period Filtering** - View scores by week, month, year, or all time
- **Admin Controls** - League creator can delete/reassign scores
- **Offline Support** - Service worker caches app shell
- **No Authentication** - Identity stored locally per device

## Scoring

### Wordle
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
| Achievement | Points |
|-------------|--------|
| Completed puzzle | 1 |
| Purple (hardest) first | +1 |
| Perfect order (purple → blue → green → yellow) | +1 |
| **Maximum** | **3** |
