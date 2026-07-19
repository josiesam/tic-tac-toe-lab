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
3. Deploy with the default Vercel settings.
4. Player 1 opens the site and clicks `Create code`.
5. Player 2 opens the same site, enters the code, and clicks `Join`.

## Beginner note

This version stores rooms in server memory so the code stays small and readable. It is good for a simple class demo, but rooms can disappear if the server restarts. A stronger version would use a small database.
