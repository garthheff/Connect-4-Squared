// Manual WebRTC signalling. No game server, accounts, or relay.
window.onlineGame = (() => {
  let peer = null
  let channel = null
  let player = 1
  let active = false
  let generation = 0
  const dialog = document.getElementById("connectionDialog")
  const input = document.getElementById("connectionInput")
  const output = document.getElementById("connectionOutput")
  const status = document.getElementById("connectionStatus")
  const report = text => { status.textContent = text }
  const encode = description => btoa(JSON.stringify(description))
  function decode(value) {
    const code = value.includes("#invite=") ? value.split("#invite=")[1] : value
    if (code.length > 100000) throw new Error("Code is too long")
    const description = JSON.parse(atob(decodeURIComponent(code.trim())))
    if (!["offer", "answer"].includes(description.type) || typeof description.sdp !== "string") throw new Error("Invalid connection code")
    return description
  }
  function leave() {
    generation++
    active = false
    if (channel) channel.close()
    if (peer) peer.close()
    channel = peer = null
    output.value = ""
    api.onLeave?.()
  }
  function setup(role) {
    leave()
    player = role
    active = true
    peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] })
    const thisPeer = peer
    peer.onconnectionstatechange = () => {
      if (peer !== thisPeer) return
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
        report("Connection lost or unavailable. Create a fresh invite to reconnect. Some networks cannot connect without a relay.")
        api.onState?.()
      }
    }
    return peer
  }
  function bind(nextChannel) {
    channel = nextChannel
    channel.onopen = () => {
      report("Connected! Host is Red; guest is Yellow.")
      api.onStart?.()
      dialog.close()
    }
    channel.onclose = () => { report("Disconnected. Start a fresh invite to reconnect."); api.onState?.() }
    channel.onmessage = event => {
      try {
        if (event.data.length > 1000) return
        const message = JSON.parse(event.data)
        if (message.type === "move") api.onMove?.(message)
        if (message.type === "reset" && player === 2) api.onReset?.()
      } catch { report("Received an invalid message.") }
    }
  }
  async function gather(connection) {
    if (connection.iceGatheringState === "complete") return
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { cleanup(); reject(new Error("Connection gathering timed out. Try again.")) }, 20000)
      const listener = () => { if (connection.iceGatheringState === "complete") { cleanup(); resolve() } }
      function cleanup() { clearTimeout(timeout); connection.removeEventListener("icegatheringstatechange", listener) }
      connection.addEventListener("icegatheringstatechange", listener)
    })
  }
  async function run(action) {
    try {
      if (!window.RTCPeerConnection) throw new Error("This browser does not support WebRTC.")
      report("Preparing connection…")
      await action()
    } catch (error) { report(error.message || "Unable to connect. Try a fresh invite.") }
  }
  const api = {
    get active() { return active },
    get player() { return player },
    get connected() { return channel?.readyState === "open" },
    send(message) { if (!api.connected) return false; channel.send(JSON.stringify(message)); return true },
    leave
  }
  document.getElementById("online").onclick = () => dialog.showModal()
  document.getElementById("closeConnection").onclick = () => dialog.close()
  document.getElementById("leaveOnline").onclick = () => { leave(); report("Returned to computer play."); dialog.close() }
  document.getElementById("hostOnline").onclick = () => run(async () => {
    const connection = setup(1)
    const token = generation
    bind(connection.createDataChannel("connect4"))
    await connection.setLocalDescription(await connection.createOffer())
    await gather(connection)
    if (token !== generation) return
    output.value = location.href.split("#")[0] + "#invite=" + encode(connection.localDescription)
    report("Send this invite link. Then paste your friend's reply code above.")
    api.onState?.()
  })
  document.getElementById("acceptOnline").onclick = () => run(async () => {
    const description = decode(input.value)
    if (description.type === "answer") {
      if (!peer || player !== 1 || peer.signalingState !== "have-local-offer") throw new Error("Create an invite first, then accept its reply.")
      await peer.setRemoteDescription(description)
      report("Reply accepted. Connecting…")
    } else {
      const connection = setup(2)
      const token = generation
      connection.ondatachannel = event => bind(event.channel)
      await connection.setRemoteDescription(description)
      await connection.setLocalDescription(await connection.createAnswer())
      await gather(connection)
      if (token !== generation) return
      output.value = encode(connection.localDescription)
      report("Send this reply code to the host. Keep this page open.")
      api.onState?.()
    }
  })
  document.getElementById("copyConnection").onclick = async () => {
    try { await navigator.clipboard.writeText(output.value); report("Copied. Send it privately to your friend.") }
    catch { output.select(); report("Select the text and copy it manually.") }
  }
  if (location.hash.startsWith("#invite=")) {
    input.value = location.href
    history.replaceState(null, "", location.href.split("#")[0])
    dialog.showModal()
  }
  return api
})()
