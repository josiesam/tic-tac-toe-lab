# Tic-Tac-Toe Lab

A beginner-friendly tic-tac-toe variant for learning coding concept in a fun way.

## What makes this version different?

Each player only gets 3 pieces. After a player has placed all 3 pieces, their next move takes their earliest placed piece and moves it to the new square.

This helps students think about:

- game rules
- sequence and memory
- queues: first in, first out
- client and server communication

## Files

- `index.html` builds the page structure.
- `styles.css` controls the design.
- `script.js` controls the browser game.
- `api/room.js` controls simple online room play on Vercel.

## Playing locally

The local two-player mode works by opening `index.html` in a browser.

The online room mode needs Vercel because it uses `/api/room`.

## Hosting on Vercel from GitHub

1. Push these files to a GitHub repository.
2. Create a new Vercel project from that GitHub repository.
3. Add a Vercel Redis or Upstash Redis database.
4. Add these environment variables in Vercel:
   - `TIC_TAC_TOC_KV_REST_API_URL` and `TIC_TAC_TOC_KV_REST_API_TOKEN`
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN`
   - or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
5. Redeploy the project.
6. Player 1 opens the site and clicks `Create code`.
7. Player 2 opens the same site, enters the code, and clicks `Join`.

## Beginner note

The app uses Redis for hosted online rooms. If Redis is not configured, it falls back to memory for local learning, but memory rooms can disappear on Vercel between requests.
