(() => {
  const rules = document.getElementById("rulesDialog")
  document.getElementById("rulesButton").addEventListener("click", () => rules.showModal())
  document.getElementById("closeRules").addEventListener("click", () => rules.close())
  const theme = document.getElementById("theme")
  let saved
  try { saved = localStorage.getItem("connect4-theme") } catch {}
  theme.value = ["light", "dark", "colourful"].includes(saved) ? saved : "dark"
  function applyTheme() {
    document.documentElement.dataset.theme = theme.value
    try { localStorage.setItem("connect4-theme", theme.value) } catch {}
  }
  theme.addEventListener("change", applyTheme)
  applyTheme()

  // Measure the actual wrapped headers, rather than assuming a fixed height.
  const wrap = document.querySelector(".wrap")
  const top = document.querySelector(".top")
  const panel = document.querySelector(".panel")
  const modal = document.querySelector(".modal")
  const board = document.getElementById("bigBoard")
  function fit() {
    const wrapStyle = getComputedStyle(wrap)
    const available = Math.max(40, innerHeight - top.getBoundingClientRect().height - parseFloat(wrapStyle.paddingTop) - parseFloat(wrapStyle.paddingBottom) - parseFloat(getComputedStyle(top).marginBottom))
    const width = Math.min(wrap.clientWidth, available * 49 / 36)
    panel.style.width = `${width}px`
    panel.style.height = `${width * 36 / 49}px`
    panel.classList.toggle("compactLabels", width < 650)
    if (document.getElementById("overlay").classList.contains("open")) {
      const styles = getComputedStyle(modal)
      const header = modal.querySelector(".modalTop")
      const footer = modal.querySelector(".footerHelp")
      const height = Math.max(30, innerHeight - 32 - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom) - header.getBoundingClientRect().height - parseFloat(getComputedStyle(header).marginBottom) - footer.getBoundingClientRect().height - (getComputedStyle(footer).display === "none" ? 0 : 10) - 4)
      const boardWidth = Math.min(modal.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight), height * 7 / 6)
      board.style.width = `${boardWidth}px`
      board.style.height = `${boardWidth * 6 / 7}px`
    }
  }
  new ResizeObserver(fit).observe(top)
  new ResizeObserver(fit).observe(modal.querySelector(".modalTop"))
  new MutationObserver(fit).observe(document.getElementById("overlay"), { attributes: true, attributeFilter: ["class"] })
  addEventListener("resize", fit)
  fit()
})()
