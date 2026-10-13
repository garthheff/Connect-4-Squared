const META_ROWS = 6
const META_COLS = 7
const ROWS = 6
const COLS = 7

const EMPTY = 0
const HUMAN = 1
const AI = 2

const OWN_NONE = 0
const OWN_HUMAN = 1
const OWN_AI = 2

let minis
let current
let gameOver
let aiThinking
let selectedTile
let overlayOpen
let overlayTile
let difficulty
let aiTimer = null
let feedbackTimer = null
let switchBannerTimer = null
let lastMoveTile
let previousMoveTile
let selectionNotice
let selectionIsSwitch
let moveNumber = 0
let lastBoardByPlayer = { 1: null, 2: null }
let latestDisc = null
let winningMetaTiles = new Set()
const online = window.onlineGame

const metaEl = document.getElementById("meta")
const overlayEl = document.getElementById("overlay")
const bigEl = document.getElementById("bigBoard")
const statusEl = document.getElementById("status")
const modalTitleEl = document.getElementById("modalTitle")
const modalSubEl = document.getElementById("modalSub")
const panelEl = document.getElementById("panel")
const difficultyEl = document.getElementById("difficulty")
const miniResultEl = document.getElementById("miniResult")
const miniResultIconEl = document.getElementById("miniResultIcon")
const miniResultTextEl = document.getElementById("miniResultText")
const boardSwitchBannerEl = document.getElementById("boardSwitchBanner")

const fx = window.createFx({
  canvas: document.getElementById("fxCanvas"),
  banner: document.getElementById("resultBanner"),
  bannerText: document.getElementById("resultText"),
  panel: panelEl
})

function idxToRC(i) {
  return { r: Math.floor(i / META_COLS), c: i % META_COLS }
}

function rcToIdx(r, c) {
  return r * META_COLS + c
}

function cloneGrid(g) {
  return g.map(row => row.slice())
}

function makeMini() {
  return {
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY)),
    owner: OWN_NONE,
    locked: false,
    playable: false
  }
}

function setStatus(text) {
  if (text) {
    statusEl.textContent = text
    return
  }
  if (gameOver) return
  if (online.active) {
    statusEl.textContent = !online.connected ? "Online: waiting for connection…" : current === online.player ? `Your turn (${current === HUMAN ? "Red" : "Yellow"})` : `Friend's turn (${current === HUMAN ? "Red" : "Yellow"})`
    return
  }
  if (aiThinking) {
    statusEl.textContent = `${difficultyLabel()} computer thinking...`
    return
  }
  statusEl.textContent = current === HUMAN ? "Your turn (Red)" : `${difficultyLabel()} computer's turn (Yellow)`
}

function difficultyLabel() {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
}

function newGame() {
  latestDisc = null
  lastBoardByPlayer = { 1: null, 2: null }
  winningMetaTiles = new Set()
  if (aiTimer !== null) {
    clearTimeout(aiTimer)
    aiTimer = null
  }
  if (feedbackTimer !== null) {
    clearTimeout(feedbackTimer)
    feedbackTimer = null
  }
  if (switchBannerTimer !== null) {
    clearTimeout(switchBannerTimer)
    switchBannerTimer = null
  }
  difficulty = difficultyEl.value
  moveNumber = 0
  difficultyEl.disabled = online.active
  minis = Array.from({ length: META_ROWS * META_COLS }, makeMini)

  for (let c = 0; c < META_COLS; c++) {
    minis[rcToIdx(META_ROWS - 1, c)].playable = true
  }

  current = HUMAN
  gameOver = false
  aiThinking = false
  selectedTile = rcToIdx(META_ROWS - 1, 0)
  overlayOpen = false
  overlayTile = selectedTile
  lastMoveTile = null
  previousMoveTile = null
  selectionNotice = "Choose any highlighted board"
  selectionIsSwitch = false

  overlayEl.classList.remove("open")
  overlayEl.setAttribute("aria-hidden", "true")
  panelEl.classList.remove("flipLose")
  miniResultEl.className = "miniResult"
  boardSwitchBannerEl.className = "boardSwitchBanner"
  fx.stop()

  renderAll()
  setStatus()
}

function isMetaPlayable(i) {
  const m = minis[i]
  return m.playable && !m.locked && m.owner === OWN_NONE
}

function unlockAboveIfAny(i) {
  const rc = idxToRC(i)
  const aboveR = rc.r - 1
  if (aboveR < 0) return
  const aboveIdx = rcToIdx(aboveR, rc.c)
  const above = minis[aboveIdx]
  if (above.owner === OWN_NONE && !above.locked) above.playable = true
}

function lowestEmptyRow(g, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (g[r][col] === EMPTY) return r
  }
  return -1
}

function isDrawMini(g) {
  for (let c = 0; c < COLS; c++) {
    if (g[0][c] === EMPTY) return false
  }
  return true
}

function countDirMini(g, r, c, dr, dc, p) {
  let n = 0
  let rr = r + dr
  let cc = c + dc
  while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && g[rr][cc] === p) {
    n += 1
    rr += dr
    cc += dc
  }
  return n
}

function isWinMini(g, r, c, p) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]]
  for (const d of dirs) {
    const dr = d[0]
    const dc = d[1]
    const a = countDirMini(g, r, c, dr, dc, p)
    const b = countDirMini(g, r, c, -dr, -dc, p)
    if (1 + a + b >= 4) return true
  }
  return false
}

function ownersMatrixWithOverride(tileIndex, ownerOverride) {
  const m = Array.from({ length: META_ROWS }, () => Array(META_COLS).fill(OWN_NONE))
  for (let r = 0; r < META_ROWS; r++) {
    for (let c = 0; c < META_COLS; c++) {
      m[r][c] = minis[rcToIdx(r, c)].owner
    }
  }
  if (tileIndex !== null && ownerOverride !== null) {
    const rc = idxToRC(tileIndex)
    m[rc.r][rc.c] = ownerOverride
  }
  return m
}

function countDirMeta(m, r, c, dr, dc, owner) {
  let n = 0
  let rr = r + dr
  let cc = c + dc
  while (rr >= 0 && rr < META_ROWS && cc >= 0 && cc < META_COLS && m[rr][cc] === owner) {
    n += 1
    rr += dr
    cc += dc
  }
  return n
}

function isWinMeta(m, r, c, owner) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]]
  for (const d of dirs) {
    const dr = d[0]
    const dc = d[1]
    const a = countDirMeta(m, r, c, dr, dc, owner)
    const b = countDirMeta(m, r, c, -dr, -dc, owner)
    if (1 + a + b >= 4) return true
  }
  return false
}

function resetMini(mini) {
  mini.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY))
}

function endMetaWin(owner) {
  gameOver = true
  if (owner === (online.active ? online.player : OWN_HUMAN)) {
    setStatus("You win the meta game!")
    fx.showWin(20000)
  } else {
    setStatus(online.active ? "Your friend wins the meta game!" : "AI wins the meta game!")
    fx.showLose()
  }
}

function finalizeMiniWin(tileIndex, owner) {
  const mini = minis[tileIndex]
  mini.winningCells = findWinningMiniCells(mini.grid, owner)
  mini.owner = owner
  mini.locked = true
  mini.playable = false

  unlockAboveIfAny(tileIndex)

  const m = ownersMatrixWithOverride(null, null)
  const rc = idxToRC(tileIndex)
  if (isWinMeta(m, rc.r, rc.c, owner)) {
    winningMetaTiles = findWinningMetaTiles(m, rc.r, rc.c, owner)
    endMetaWin(owner)
  }
}

function findWinningMiniCells(grid, player) {
  const cells = new Set()
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const endR = r + 3 * dr
        const endC = c + 3 * dc
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue
        if ([0, 1, 2, 3].every(k => grid[r + k * dr][c + k * dc] === player)) {
          for (let k = 0; k < 4; k++) cells.add((r + k * dr) * COLS + c + k * dc)
        }
      }
    }
  }
  return cells
}

function findWinningMetaTiles(matrix, row, col, owner) {
  const winners = new Set()
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [rcToIdx(row, col)]
    for (const sign of [-1, 1]) {
      let r = row + dr * sign
      let c = col + dc * sign
      while (r >= 0 && r < META_ROWS && c >= 0 && c < META_COLS && matrix[r][c] === owner) {
        line.push(rcToIdx(r, c))
        r += dr * sign
        c += dc * sign
      }
    }
    if (line.length >= 4) for (const tile of line) winners.add(tile)
  }
  return winners
}

function openOverlay(i) {
  if (!isMetaPlayable(i) && minis[i].owner === OWN_NONE) return
  selectionIsSwitch = false
  if (minis[i].owner !== OWN_NONE) {
    selectionNotice = "Claimed board — viewing the winning discs"
  } else if (lastMoveTile === null) {
    selectionNotice = "First move — choose a column"
  } else if (i !== lastMoveTile) {
    const last = idxToRC(lastMoveTile)
    const next = idxToRC(i)
    const chooser = online.active ? (current === online.player ? "You" : "Your friend") : current === HUMAN ? "You" : "Computer"
    selectionNotice = `${chooser} switched: Board C${last.c + 1}/R${last.r + 1} → Board C${next.c + 1}/R${next.r + 1}`
    selectionIsSwitch = true
  } else {
    selectionNotice = "Continuing on the last-played board"
  }
  overlayOpen = true
  overlayTile = i
  selectedTile = i
  overlayEl.classList.add("open")
  overlayEl.setAttribute("aria-hidden", "false")
  renderAll()
  if (selectionIsSwitch) showBoardSwitchBanner(selectionNotice)
}

function closeOverlay() {
  overlayOpen = false
  renderMeta()
  overlayEl.classList.remove("open")
  overlayEl.setAttribute("aria-hidden", "true")
  boardSwitchBannerEl.className = "boardSwitchBanner"
  if (switchBannerTimer !== null) {
    clearTimeout(switchBannerTimer)
    switchBannerTimer = null
  }
}

function showBoardSwitchBanner(message) {
  if (switchBannerTimer !== null) clearTimeout(switchBannerTimer)
  boardSwitchBannerEl.textContent = message
  boardSwitchBannerEl.className = "boardSwitchBanner show"
  switchBannerTimer = setTimeout(() => {
    boardSwitchBannerEl.className = "boardSwitchBanner"
    switchBannerTimer = null
  }, 1800)
}

function showMiniResult(owner, isDraw = false) {
  boardSwitchBannerEl.className = "boardSwitchBanner"
  if (switchBannerTimer !== null) {
    clearTimeout(switchBannerTimer)
    switchBannerTimer = null
  }
  miniResultEl.className = "miniResult show"
  if (isDraw) {
    miniResultEl.classList.add("draw")
    miniResultIconEl.textContent = "↻"
    miniResultTextEl.textContent = "Draw — board reset"
  } else if (owner === OWN_HUMAN) {
    miniResultEl.classList.add("human")
    miniResultIconEl.textContent = "✓"
    miniResultTextEl.textContent = online.active ? "Red claimed this board!" : "Board claimed — yours!"
  } else {
    miniResultEl.classList.add("computer")
    miniResultIconEl.textContent = "!"
    miniResultTextEl.textContent = online.active ? "Yellow claimed this board!" : "Computer claimed this board"
  }

  feedbackTimer = setTimeout(() => {
    miniResultEl.className = "miniResult"
    feedbackTimer = null
    closeOverlay()
  }, 1050)
}

function applyMoveToMini(grid, col, player) {
  const row = lowestEmptyRow(grid, col)
  if (row === -1) return null
  const ng = cloneGrid(grid)
  ng[row][col] = player
  return { grid: ng, row }
}

function miniImmediateWinCols(grid, player) {
  const cols = []
  for (let c = 0; c < COLS; c++) {
    const applied = applyMoveToMini(grid, c, player)
    if (!applied) continue
    if (isWinMini(applied.grid, applied.row, c, player)) cols.push(c)
  }
  return cols
}

function validColsForMini(grid) {
  const cols = []
  for (let c = 0; c < COLS; c++) {
    if (grid[0][c] === EMPTY) cols.push(c)
  }
  return cols
}

function metaCenterScore(tileIndex) {
  const rc = idxToRC(tileIndex)
  const dc = Math.abs(rc.c - 3)
  const dr = Math.abs(rc.r - 2.5)
  return (7 - dc * 2) + (6 - dr)
}

function evaluateMove(tileIndex, col, player) {
  const mini = minis[tileIndex]
  if (!isMetaPlayable(tileIndex)) return -Infinity

  const applied = applyMoveToMini(mini.grid, col, player)
  if (!applied) return -Infinity

  let score = 0

  score += metaCenterScore(tileIndex) * 3
  score += (7 - Math.abs(col - 3)) * 2

  const winsNow = isWinMini(applied.grid, applied.row, col, player)
  if (winsNow) score += 2500

  const opp = player === AI ? HUMAN : AI
  const oppWins = miniImmediateWinCols(mini.grid, opp)
  if (oppWins.includes(col)) score += 220

  if (winsNow) {
    const owner = player === AI ? OWN_AI : OWN_HUMAN
    const m = ownersMatrixWithOverride(tileIndex, owner)
    const rc = idxToRC(tileIndex)
    if (isWinMeta(m, rc.r, rc.c, owner)) score += 1000000
  }

  return score
}

function validMetaMoves() {
  const moves = []
  for (let i = 0; i < minis.length; i++) {
    if (isMetaPlayable(i)) moves.push(i)
  }
  return moves
}

function legalMoves(state = minis) {
  const moves = []
  for (let t = 0; t < state.length; t++) {
    const mini = state[t]
    if (!mini.playable || mini.locked || mini.owner !== OWN_NONE) continue
    for (const c of validColsForMini(mini.grid)) moves.push({ t, c })
  }
  return moves
}

function ownersMatrixFor(state) {
  return Array.from({ length: META_ROWS }, (_, r) =>
    Array.from({ length: META_COLS }, (_, c) => state[rcToIdx(r, c)].owner)
  )
}

function simulateMove(state, move, player) {
  const next = state.map(m => ({ ...m, grid: cloneGrid(m.grid) }))
  const mini = next[move.t]
  const applied = applyMoveToMini(mini.grid, move.c, player)
  if (!applied) return null

  mini.grid = applied.grid
  let metaWinner = OWN_NONE
  if (isWinMini(mini.grid, applied.row, move.c, player)) {
    mini.owner = player === AI ? OWN_AI : OWN_HUMAN
    mini.locked = true
    mini.playable = false
    const rc = idxToRC(move.t)
    if (rc.r > 0) {
      const above = next[rcToIdx(rc.r - 1, rc.c)]
      if (above.owner === OWN_NONE && !above.locked) above.playable = true
    }
    if (isWinMeta(ownersMatrixFor(next), rc.r, rc.c, mini.owner)) metaWinner = mini.owner
  } else if (isDrawMini(mini.grid)) {
    mini.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY))
  }
  return { state: next, metaWinner }
}

function scoreWindows(grid, rows, cols, aiPiece, humanPiece, weights) {
  let score = 0
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of directions) {
        const endR = r + dr * 3
        const endC = c + dc * 3
        if (endR < 0 || endR >= rows || endC < 0 || endC >= cols) continue
        let aiCount = 0
        let humanCount = 0
        for (let k = 0; k < 4; k++) {
          const value = grid[r + dr * k][c + dc * k]
          if (value === aiPiece) aiCount++
          if (value === humanPiece) humanCount++
        }
        if (!humanCount) score += weights[aiCount]
        if (!aiCount) score -= weights[humanCount] * 1.12
      }
    }
  }
  return score
}

function evaluateState(state) {
  const owners = ownersMatrixFor(state)
  let score = scoreWindows(owners, META_ROWS, META_COLS, OWN_AI, OWN_HUMAN, [0, 30, 220, 1800, 1000000])

  for (let i = 0; i < state.length; i++) {
    const mini = state[i]
    if (mini.owner === OWN_AI) score += 1100 + metaCenterScore(i) * 8
    if (mini.owner === OWN_HUMAN) score -= 1230 + metaCenterScore(i) * 8
    if (mini.owner !== OWN_NONE || !mini.playable) continue
    score += scoreWindows(mini.grid, ROWS, COLS, AI, HUMAN, [0, 2, 15, 130, 3000])
    for (let r = 0; r < ROWS; r++) {
      if (mini.grid[r][3] === AI) score += 4
      if (mini.grid[r][3] === HUMAN) score -= 4
    }
  }
  return score
}

function randomMove(moves) {
  return moves[Math.floor(Math.random() * moves.length)]
}

function chooseMediumMove(moves) {
  const ranked = moves.map(move => {
    const mini = minis[move.t]
    let score = evaluateMove(move.t, move.c, AI)
    if (miniImmediateWinCols(mini.grid, HUMAN).includes(move.c)) {
      score += 1800
      const rc = idxToRC(move.t)
      const threatenedOwners = ownersMatrixWithOverride(move.t, OWN_HUMAN)
      if (isWinMeta(threatenedOwners, rc.r, rc.c, OWN_HUMAN)) score += 2000000
    }
    score += Math.random() * 80
    return { move, score }
  }).sort((a, b) => b.score - a.score)

  // Occasionally choose another good move so Medium stays beatable.
  const pool = ranked.slice(0, Math.min(3, ranked.length))
  return Math.random() < 0.82 ? ranked[0].move : randomMove(pool).move
}

function chooseHardMove(moves) {
  let bestScore = -Infinity
  let bestMoves = []

  for (const move of moves) {
    const result = simulateMove(minis, move, AI)
    if (!result) continue
    let score

    if (result.metaWinner === OWN_AI) {
      score = 100000000
    } else {
      const replies = legalMoves(result.state)
      let worstReply = Infinity
      for (const reply of replies) {
        const response = simulateMove(result.state, reply, HUMAN)
        if (!response) continue
        const replyScore = response.metaWinner === OWN_HUMAN
          ? -100000000
          : evaluateState(response.state)
        worstReply = Math.min(worstReply, replyScore)
      }
      score = worstReply === Infinity ? evaluateState(result.state) : worstReply
      score += metaCenterScore(move.t) * 0.01 + (7 - Math.abs(move.c - 3)) * 0.001
    }

    if (score > bestScore + 0.0001) {
      bestScore = score
      bestMoves = [move]
    } else if (Math.abs(score - bestScore) <= 0.0001) {
      bestMoves.push(move)
    }
  }
  return randomMove(bestMoves)
}

function aiChooseMove() {
  const moves = legalMoves()
  if (!moves.length) return null
  if (difficulty === "easy") return randomMove(moves)
  if (difficulty === "medium") return chooseMediumMove(moves)
  return chooseHardMove(moves)
}

function aiMove() {
  aiTimer = null
  if (gameOver) {
    aiThinking = false
    setStatus()
    renderAll()
    return
  }

  const metaMoves = validMetaMoves()
  if (!metaMoves.length) {
    aiThinking = false
    setStatus("No meta moves left")
    return
  }

  const pick = aiChooseMove()
  if (!pick) {
    aiThinking = false
    setStatus("No moves left")
    return
  }

  aiThinking = false
  current = AI
  selectedTile = pick.t
  openOverlay(pick.t)
  setStatus()
  playMove(pick.t, pick.c)
}

function playMove(tileIndex, col, remote = false) {
  if (gameOver || aiThinking) return
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= minis.length || !Number.isInteger(col) || col < 0 || col >= COLS) return
  if (online.active && (!online.connected || (remote ? current === online.player : current !== online.player))) return
  if (!isMetaPlayable(tileIndex)) return

  const mini = minis[tileIndex]
  const row = lowestEmptyRow(mini.grid, col)
  if (row === -1) return

  mini.grid[row][col] = current
  latestDisc = { tile: tileIndex, row, col }
  lastBoardByPlayer[current] = tileIndex
  if (online.active && !remote) online.send({ type: "move", t: tileIndex, c: col, n: moveNumber })
  moveNumber++
  previousMoveTile = lastMoveTile
  lastMoveTile = tileIndex

  let miniResult = null
  if (isWinMini(mini.grid, row, col, current)) {
    miniResult = current === HUMAN ? OWN_HUMAN : OWN_AI
    finalizeMiniWin(tileIndex, miniResult)
  } else if (isDrawMini(mini.grid)) {
    resetMini(mini)
    miniResult = "draw"
  }

  current = current === HUMAN ? AI : HUMAN
  setStatus()
  renderAll()

  if (miniResult !== null) showMiniResult(miniResult, miniResult === "draw")

  if (!online.active && !gameOver && current === AI) {
    aiThinking = true
    setStatus()
    renderAll()
    aiTimer = setTimeout(aiMove, miniResult === null ? 220 : 1100)
  }
}

function renderMeta() {
  metaEl.innerHTML = ""
  metaEl.classList.toggle("hasWinner", winningMetaTiles.size > 0)

  for (let i = 0; i < minis.length; i++) {
    const m = minis[i]

    const tile = document.createElement("div")
    tile.className = "tile"
    if (winningMetaTiles.has(i)) {
      tile.classList.add("winningTile")
      tile.setAttribute("title", "Part of the winning four in a row")
    }

    if (i === selectedTile) tile.classList.add("selected")
    if (i === lastMoveTile) tile.classList.add("lastPlayed")
    if (i === previousMoveTile && i !== lastMoveTile) tile.classList.add("previousPlayed")
    if (m.owner !== OWN_NONE) tile.classList.add("owned")
    if (!isMetaPlayable(i) && m.owner === OWN_NONE) tile.classList.add("disabled")

    const miniBoard = document.createElement("div")
    miniBoard.className = "mini"

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div")
        cell.className = "miniCell"

        const disc = document.createElement("div")
        disc.className = "miniDisc"
        if (latestDisc?.tile === i && latestDisc.row === r && latestDisc.col === c && m.grid[r][c] !== EMPTY) disc.classList.add("latestDisc")
        const v = m.grid[r][c]
        if (v === HUMAN) disc.classList.add("p1")
        if (v === AI) disc.classList.add("p2")

        cell.appendChild(disc)
        miniBoard.appendChild(cell)
      }
    }

    const wrap = document.createElement("div")
    wrap.className = "metaDiscWrap"

    const metaDisc = document.createElement("div")
    metaDisc.className = "metaDisc"
    if (m.owner === OWN_HUMAN) metaDisc.classList.add("p1")
    if (m.owner === OWN_AI) metaDisc.classList.add("p2")

    wrap.appendChild(metaDisc)

    if (m.owner !== OWN_NONE) {
      const claimLabel = document.createElement("div")
      claimLabel.className = "claimLabel"
      claimLabel.textContent = online.active ? (m.owner === OWN_HUMAN ? "RED" : "YELLOW") : m.owner === OWN_HUMAN ? "YOURS" : "CPU"
      wrap.appendChild(claimLabel)
      tile.setAttribute("aria-label", m.owner === OWN_HUMAN ? "Board claimed by you" : "Board claimed by computer")
    }

    tile.appendChild(miniBoard)
    tile.appendChild(wrap)

    if (i === lastMoveTile || (i === previousMoveTile && i !== lastMoveTile) || (overlayOpen && i === selectedTile && i !== lastMoveTile)) {
      const moveBadge = document.createElement("div")
      moveBadge.className = "moveBadge"
      if (overlayOpen && i === selectedTile && i !== lastMoveTile) {
        moveBadge.classList.add("chosen")
        moveBadge.textContent = "CHOSEN"
      } else if (i === lastMoveTile) {
        moveBadge.classList.add("latest")
        moveBadge.textContent = "LAST MOVE"
      } else if (i === previousMoveTile) {
        moveBadge.classList.add("previous")
        moveBadge.textContent = "PREVIOUS"
      }
      tile.appendChild(moveBadge)
    }

    tile.addEventListener("click", () => openOverlay(i))

    metaEl.appendChild(tile)
  }
}

function renderOverlay() {
  if (!overlayOpen) return

  const mini = minis[overlayTile]
  const rc = idxToRC(overlayTile)
  const localPlayer = online.active ? online.player : HUMAN
  const previousBoard = lastBoardByPlayer[localPlayer]
  const backButton = document.getElementById("backToMyBoard")
  const canReturn = previousBoard !== null && previousBoard !== overlayTile && isMetaPlayable(previousBoard) && !gameOver
  backButton.disabled = !canReturn
  if (previousBoard !== null) {
    const previous = idxToRC(previousBoard)
    backButton.textContent = "Previous board"
    backButton.title = canReturn ? `Return to your previous board: column ${previous.c + 1}, row ${previous.r + 1}` : "Already viewing your previous board, or it has been claimed"
  } else {
    backButton.textContent = "Previous board"
    backButton.title = "Play your first move to save a board"
  }

  modalTitleEl.textContent = "Mini board col " + (rc.c + 1) + " row " + (rc.r + 1)

  const inspecting = mini.owner !== OWN_NONE
  const turnIndicator = document.getElementById("turnIndicator")
  turnIndicator.className = "turnIndicator"
  if (inspecting || gameOver) {
    turnIndicator.textContent = inspecting ? "Viewing claimed board" : "Game over"
  } else if (online.active && !online.connected) {
    turnIndicator.textContent = "Connection unavailable • play paused"
  } else {
    const yours = current === (online.active ? online.player : HUMAN)
    turnIndicator.textContent = aiThinking ? "Computer thinking…" : yours ? "Your turn — choose a column" : online.active ? "Your friend's turn" : "Computer's turn"
    turnIndicator.classList.add(current === HUMAN ? "redTurn" : "yellowTurn")
  }
  if (inspecting) modalSubEl.textContent = `${mini.owner === OWN_HUMAN ? "Red" : "Yellow"} won this board • highlighted discs form the winning line • view only`
  else if (gameOver) modalSubEl.textContent = "Game over"
  else if (selectionNotice) modalSubEl.textContent = selectionNotice
  else if (aiThinking) modalSubEl.textContent = `${difficultyLabel()} computer thinking...`
  else modalSubEl.textContent = current === HUMAN ? "Your move" : "Computer move"
  modalSubEl.classList.toggle("switchNotice", selectionIsSwitch && !gameOver)

  bigEl.innerHTML = ""
  bigEl.classList.toggle("inspecting", inspecting)
  const help = document.querySelector(".footerHelp > div")
  help.textContent = inspecting ? "Claimed board • no further moves" : "Click a column to drop"

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div")
      cell.className = "bigCell"
      if (inspecting && mini.winningCells?.has(r * COLS + c)) {
        cell.classList.add("winningCell")
        cell.setAttribute("aria-label", "Winning disc")
      }

      const disc = document.createElement("div")
      disc.className = "disc"
      if (latestDisc?.tile === overlayTile && latestDisc.row === r && latestDisc.col === c && mini.grid[r][c] !== EMPTY) {
        disc.classList.add("latestDisc")
        cell.setAttribute("title", "Most recent disc played")
      }
      const v = mini.grid[r][c]
      if (v === HUMAN) disc.classList.add("p1")
      if (v === AI) disc.classList.add("p2")

      cell.appendChild(disc)

      cell.addEventListener("click", () => {
        if (inspecting) return
        if (online.active ? current !== online.player : current !== HUMAN) return
        playMove(overlayTile, c)
      })

      bigEl.appendChild(cell)
    }
  }
}

function renderAll() {
  renderMeta()
  renderOverlay()
}

document.getElementById("reset").addEventListener("click", () => {
  if (online.active) {
    if (online.player !== HUMAN || !online.connected) { setStatus("Only the connected host can start a new game"); return }
    online.send({ type: "reset" })
  }
  newGame()
})
online.onStart = newGame
online.onLeave = newGame
online.onState = () => { difficultyEl.disabled = online.active; setStatus() }
online.onReset = newGame
online.onMove = message => {
  if (message.n !== moveNumber || current === online.player || !Number.isInteger(message.t) || !Number.isInteger(message.c) || message.t < 0 || message.t >= minis.length || message.c < 0 || message.c >= COLS || !isMetaPlayable(message.t) || lowestEmptyRow(minis[message.t].grid, message.c) < 0) return
  openOverlay(message.t)
  playMove(message.t, message.c, true)
}
difficultyEl.addEventListener("change", newGame)
document.getElementById("closeOverlay").addEventListener("click", closeOverlay)
document.getElementById("backToMyBoard").addEventListener("click", () => {
  const player = online.active ? online.player : HUMAN
  const tile = lastBoardByPlayer[player]
  if (tile !== null && !gameOver && isMetaPlayable(tile)) openOverlay(tile)
})

overlayEl.addEventListener("click", (e) => {
  if (e.target === overlayEl) closeOverlay()
})

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlayOpen) closeOverlay()
})

newGame()
