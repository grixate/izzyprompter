export const socketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = import.meta.env.DEV && window.location.port === '5173' ? `${window.location.hostname}:4000` : window.location.host
  return `${protocol}://${host}/socket`
}

export const apiUrl = (path: string) => {
  const socket = new URL(socketUrl())
  socket.protocol = socket.protocol === 'wss:' ? 'https:' : 'http:'
  socket.pathname = socket.pathname.replace(/\/socket\/?$/, '') + `/api/${path}`
  socket.search = ''
  socket.hash = ''
  return socket.toString()
}
