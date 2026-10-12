https://garthheff.github.io/Connect-4-Squared/

# Connect-4-Squared 
Connect-4², I heard you liked Connect 4, so I put Connect 4 in your Connect 4.

A proof-of-concept game inspired while playing a game of Connect 4, tossed at ChatGPT and refined into this prototype.

## Computer difficulty

- **Easy** chooses a random legal mini board and column.
- **Medium** looks for immediate wins and blocks, prefers useful central moves, and occasionally chooses another strong move.
- **Hard** searches every legal move and every immediate human reply, evaluating both the mini boards and the meta board.

Changing the difficulty starts a fresh game.

The game has no build step: open `index.html` directly or serve the folder with any static web server.

## Online friends

Open the same hosted version on both devices. Choose **Online friend**, create an invite link, and send it privately. The guest opens the link and selects **Join invite / accept reply**, then sends their reply code back. The host pastes that code and accepts it. Keep both pages open. Red (host) starts and controls new games.

Moves travel directly over WebRTC, with no signalling server or TURN relay. A public Google STUN service discovers network addresses; restrictive networks may prevent connection. Codes contain network connection details: share privately. Reconnect with a new invite; games are not saved. Invite links need a reachable web URL, not a local file or localhost URL.
