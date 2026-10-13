import { isIPv4 } from 'node:net'

export function privateIPv4(address) {
  if (!isIPv4(address)) return false
  const [a, b] = address.split('.').map(Number)
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

export function localHosts(interfaces) {
  return Object.entries(interfaces)
    .filter(([name]) => !/^(utun|tun|tap|docker|veth|br-|virbr|tailscale|wg)/i.test(name))
    .sort(([a], [b]) => Number(!/^(en|eth|wl)/i.test(a)) - Number(!/^(en|eth|wl)/i.test(b)) || a.localeCompare(b))
    .flatMap(([, addresses]) => (addresses ?? []).filter((entry) => !entry.internal && privateIPv4(entry.address)).map((entry) => entry.address))
    .filter((address, index, all) => all.indexOf(address) === index)
}

export function parseOptions(args) {
  const options = { port: 4174, host: null, help: false, open: null }
  const seen = new Set()
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (flag === '--help' || flag === '-h') { options.help = true; continue }
    if (flag === '--open' || flag === '--no-open') {
      if (seen.has('open')) throw new Error('Repeated browser-opening option.')
      seen.add('open'); options.open = flag === '--open'; continue
    }
    if (!['--host', '--port'].includes(flag) || seen.has(flag)) throw new Error(`Unknown or repeated option: ${flag}`)
    seen.add(flag)
    const value = args[++index]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
    if (flag === '--port') {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('Port must be an integer from 1 to 65535.')
      options.port = Number(value)
    } else {
      if (!privateIPv4(value) && value !== '127.0.0.1') throw new Error('Host must be a private IPv4 address on this computer, or 127.0.0.1.')
      options.host = value
    }
  }
  return options
}

export function chooseHost(requested, hosts) {
  if (requested === '127.0.0.1') return requested
  if (requested && !hosts.includes(requested)) throw new Error('The requested host is not on an eligible local interface. Check Wi-Fi or choose one of the detected addresses.')
  return requested ?? hosts[0] ?? '127.0.0.1'
}
