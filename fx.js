function rand(a, b) {
  return a + Math.random() * (b - a)
}

export function createFx(opts) {
  const canvas = opts.canvas
  const banner = opts.banner
  const bannerText = opts.bannerText
  const panel = opts.panel

  const ctx = canvas.getContext("2d")

  let particles = []
  let running = false
  let burstTimer = null
  let endAt = 0

  function resize() {
    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function stop() {
    canvas.classList.remove("show")
    banner.classList.remove("show")
    particles = []
    running = false
    if (burstTimer) {
      clearInterval(burstTimer)
      burstTimer = null
    }
  }

  function spawnFireworkBurst(x, y) {
    const count = Math.floor(rand(70, 130))
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2)
      const spd = rand(2.2, 7.2)
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(55, 110),
        r: rand(2, 4.5),
        kind: "spark"
      })
    }
  }

  function spawnDiscExplosion() {
    const count = 240
    for (let i = 0; i < count; i++) {
      const isRed = Math.random() < 0.5
      particles.push({
        x: rand(0, window.innerWidth),
        y: rand(window.innerHeight * 0.2, window.innerHeight * 0.8),
        vx: rand(-6, 6),
        vy: rand(-10, -2),
        life: rand(70, 120),
        r: rand(6, 10),
        kind: isRed ? "discR" : "discY",
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.2, 0.2)
      })
    }
  }

  function tick() {
    if (!running) return

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life -= 1

      if (p.kind === "spark") {
        p.vx *= 0.985
        p.vy = p.vy * 0.985 + 0.06
        p.x += p.vx
        p.y += p.vy

        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 110))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(255,255,255,1)"
        ctx.fill()
        ctx.globalAlpha = 1
      } else {
        p.vx *= 0.99
        p.vy = p.vy + 0.18
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr

        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 110))
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.beginPath()
        ctx.arc(0, 0, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.kind === "discR" ? "#ef4444" : "#facc15"
        ctx.fill()
        ctx.restore()
        ctx.globalAlpha = 1
      }

      if (p.life <= 0 || p.y > window.innerHeight + 80) particles.splice(i, 1)
    }

    const now = performance.now()
    if (now >= endAt && particles.length === 0) stop()

    requestAnimationFrame(tick)
  }

  function showWin(durationMs) {
    resize()
    bannerText.textContent = "YOU WIN"
    banner.classList.add("show")
    canvas.classList.add("show")

    running = true
    endAt = performance.now() + durationMs

    const initialBursts = 10
    for (let i = 0; i < initialBursts; i++) {
      const x = rand(window.innerWidth * 0.12, window.innerWidth * 0.88)
      const y = rand(window.innerHeight * 0.10, window.innerHeight * 0.50)
      spawnFireworkBurst(x, y)
    }

    burstTimer = setInterval(() => {
      if (!running) return
      const now = performance.now()
      if (now >= endAt) {
        clearInterval(burstTimer)
        burstTimer = null
        return
      }

      const bursts = Math.floor(rand(1, 4))
      for (let i = 0; i < bursts; i++) {
        const x = rand(window.innerWidth * 0.08, window.innerWidth * 0.92)
        const y = rand(window.innerHeight * 0.08, window.innerHeight * 0.55)
        spawnFireworkBurst(x, y)
      }

      if (particles.length > 4500) particles.splice(0, particles.length - 4500)
    }, 260)

    requestAnimationFrame(tick)
  }

  function showLose() {
    bannerText.textContent = "TRY AGAIN"
    banner.classList.add("show")

    panel.classList.add("flipLose")

    resize()
    canvas.classList.add("show")
    running = true
    endAt = performance.now() + 5000

    setTimeout(() => {
      spawnDiscExplosion()
      requestAnimationFrame(tick)
    }, 260)
  }

  window.addEventListener("resize", resize)

  return { showWin, showLose, stop }
}
