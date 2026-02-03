import { createFx } from "./fx.js"

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

const metaEl = document.getElementById("meta")
const overlayEl = document.getElementById("overlay")
const bigEl = document.getElementById("bigBoard")
const statusEl = document.getElementById("status")
const modalTitleEl = document.getElementById("modalTitle")
const modalSubEl = document.getElementById("modalSub")
const panelEl = document.getElementById("panel")

const fx = createFx({
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
  if (aiThinking) {
    statusEl.textContent = "AI thinking..."
    return
  }
  statusEl.textContent = current === HUMAN ? "Your turn (Red)" : "AI turn (Yellow)"
}

function newGame() {
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

  overlayEl.classList.remove("open")
  overlayEl.setAttribute("aria-hidden", "true")
  panelEl.classList.remove("flipLose")
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
  if (owner === OWN_HUMAN) {
    setStatus("You win the meta game!")
    fx.showWin(20000)
  } else {
    setStatus("AI wins the meta game!")
    fx.showLose()
  }
}

function finalizeMiniWin(tileIndex, owner) {
  const mini = minis[tileIndex]
  mini.owner = owner
  mini.locked = true
  mini.playable = false

  unlockAboveIfAny(tileIndex)

  const m = ownersMatrixWithOverride(null, null)
  const rc = idxToRC(tileIndex)
  if (isWinMeta(m, rc.r, rc.c, owner)) endMetaWin(owner)
}

function openOverlay(i) {
  if (!isMetaPlayable(i)) return
  overlayOpen = true
  overlayTile = i
  selectedTile = i
  overlayEl.classList.add("open")
  overlayEl.setAttribute("aria-hidden", "false")
  renderAll()
}

function closeOverlay() {
  overlayOpen = false
  overlayEl.classList.remove("open")
  overlayEl.setAttribute("aria-hidden", "true")
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

function applyHypotheticalStateForWonTile(tileIndex, owner) {
  const m = ownersMatrixWithOverride(tileIndex, owner)
  const rc = idxToRC(tileIndex)
  return { m, rc }
}

function humanMetaWinThreatScore() {
  const metaMoves = validMetaMoves()
  let best = -Infinity

  for (const t of metaMoves) {
    const mini = minis[t]
    const winCols = miniImmediateWinCols(mini.grid, HUMAN)
    if (!winCols.length) continue

    const { m, rc } = applyHypotheticalStateForWonTile(t, OWN_HUMAN)
    if (isWinMeta(m, rc.r, rc.c, OWN_HUMAN)) best = Math.max(best, 80000)
  }

  return best === -Infinity ? 0 : best
}

function validMetaMoves() {
  const moves = []
  for (let i = 0; i < minis.length; i++) {
    if (isMetaPlayable(i)) moves.push(i)
  }
  return moves
}

function bestHumanReplyScore(simMinis, simPlayable) {
  let best = -Infinity

  for (let i = 0; i < simMinis.length; i++) {
    if (!simPlayable[i]) continue
    const mini = simMinis[i]
    const cols = validColsForMini(mini.grid)
    for (const c of cols) {
      const applied = applyMoveToMini(mini.grid, c, HUMAN)
      if (!applied) continue

      let s = 0
      s += metaCenterScore(i) * 3
      s += (7 - Math.abs(c - 3)) * 2

      const winMini = isWinMini(applied.grid, applied.row, c, HUMAN)
      if (winMini) s += 2500

      if (winMini) {
        const m = ownersMatrixWithOverride(i, OWN_HUMAN)
        const rc = idxToRC(i)
        if (isWinMeta(m, rc.r, rc.c, OWN_HUMAN)) s += 1000000
      }

      best = Math.max(best, s)
    }
  }

  return best === -Infinity ? 0 : best
}

function aiChooseMove() {
  const metaMoves = validMetaMoves()
  let best = null
  let bestScore = -Infinity

  const threat = humanMetaWinThreatScore()

  for (const t of metaMoves) {
    const mini = minis[t]
    const cols = validColsForMini(mini.grid)

    for (const c of cols) {
      const base = evaluateMove(t, c, AI)
      if (base === -Infinity) continue

      let score = base

      if (threat > 0) {
        const oppWinCols = miniImmediateWinCols(mini.grid, HUMAN)
        if (oppWinCols.length) score += 900
      }

      const simMinis = minis.map(m => ({ ...m, grid: cloneGrid(m.grid) }))
      const simPlayable = minis.map(m => isMetaPlayableSim(m))

      function isMetaPlayableSim(mm) {
        return mm.playable && !mm.locked && mm.owner === OWN_NONE
      }

      const applied = applyMoveToMini(simMinis[t].grid, c, AI)
      if (applied) {
        simMinis[t].grid = applied.grid
      }

      const winMini = applied ? isWinMini(applied.grid, applied.row, c, AI) : false
      if (winMini) {
        simMinis[t].owner = OWN_AI
        simMinis[t].locked = true
        simMinis[t].playable = false
        const rc = idxToRC(t)
        const aboveR = rc.r - 1
        if (aboveR >= 0) {
          const aboveIdx = rcToIdx(aboveR, rc.c)
          if (simMinis[aboveIdx].owner === OWN_NONE && !simMinis[aboveIdx].locked) simMinis[aboveIdx].playable = true
        }
      } else if (applied && isDrawMini(applied.grid)) {
        simMinis[t].grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY))
      }

      const humanBest = bestHumanReplyScore(simMinis, simPlayable)
      score -= humanBest * 0.9

      if (score > bestScore) {
        bestScore = score
        best = { t, c }
      }
    }
  }

  if (!best) {
    const t = metaMoves[0]
    return { t, c: 3 }
  }

  return best
}

function aiMove() {
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

  aiThinking = false
  current = AI
  selectedTile = pick.t
  openOverlay(pick.t)
  setStatus()
  playMove(pick.t, pick.c)
}

function playMove(tileIndex, col) {
  if (gameOver || aiThinking) return
  if (!isMetaPlayable(tileIndex)) return

  const mini = minis[tileIndex]
  const row = lowestEmptyRow(mini.grid, col)
  if (row === -1) return

  mini.grid[row][col] = current

  if (isWinMini(mini.grid, row, col, current)) {
    finalizeMiniWin(tileIndex, current === HUMAN ? OWN_HUMAN : OWN_AI)
  } else if (isDrawMini(mini.grid)) {
    resetMini(mini)
  }

  current = current === HUMAN ? AI : HUMAN
  setStatus()
  renderAll()

  if (!gameOver && current === AI) {
    aiThinking = true
    setStatus()
    renderAll()
    setTimeout(aiMove, 220)
  }
}

function renderMeta() {
  metaEl.innerHTML = ""

  for (let i = 0; i < minis.length; i++) {
    const m = minis[i]

    const tile = document.createElement("div")
    tile.className = "tile"

    if (i === selectedTile) tile.classList.add("selected")
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

    tile.appendChild(miniBoard)
    tile.appendChild(wrap)

    tile.addEventListener("click", () => openOverlay(i))

    metaEl.appendChild(tile)
  }
}

function renderOverlay() {
  if (!overlayOpen) return

  const mini = minis[overlayTile]
  const rc = idxToRC(overlayTile)

  modalTitleEl.textContent = "Mini board col " + (rc.c + 1) + " row " + (rc.r + 1)

  if (gameOver) modalSubEl.textContent = "Game over"
  else if (aiThinking) modalSubEl.textContent = "AI thinking..."
  else modalSubEl.textContent = current === HUMAN ? "Your move" : "AI move"

  bigEl.innerHTML = ""

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div")
      cell.className = "bigCell"

      const disc = document.createElement("div")
      disc.className = "disc"
      const v = mini.grid[r][c]
      if (v === HUMAN) disc.classList.add("p1")
      if (v === AI) disc.classList.add("p2")

      cell.appendChild(disc)

      cell.addEventListener("click", () => {
        if (current !== HUMAN) return
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

document.getElementById("reset").addEventListener("click", newGame)
document.getElementById("closeOverlay").addEventListener("click", closeOverlay)

overlayEl.addEventListener("click", (e) => {
  if (e.target === overlayEl) closeOverlay()
})

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlayOpen) closeOverlay()
})

newGame()
