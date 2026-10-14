// Optional local adapter. No external collector, persistent identity or raw URL.
// Consumers may subscribe without making any core action depend on analytics.
type Name = 'homepage_start_prompting_clicked' | 'homepage_pro_clicked' | 'connection_mode_changed' | 'offline_mode_opened' | 'offline_pairing_ready' | 'offline_remote_connected' | 'offline_pairing_error' | 'skins_opened' | 'skin_previewed' | 'locked_skin_upgrade_clicked' | 'pro_page_viewed' | 'pro_checkout_clicked' | 'pro_purchase_completed' | 'script_limit_upgrade_clicked'
type Properties = { source?: string; skin?: string; from?: 'online' | 'offline'; to?: 'online' | 'offline'; surface?: string; reason?: string }
export function track(name: Name, props: Properties = {}) {
  try {
    const properties = Object.fromEntries(Object.entries(props).filter(([, value]) => typeof value === 'string' && /^[a-z0-9_-]{1,48}$/.test(value)))
    window.dispatchEvent(new CustomEvent('izzy:product-event', { detail: { name, properties } }))
  } catch { /* Measurement must never affect a take. */ }
}
