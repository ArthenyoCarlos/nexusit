export function buildRustDeskUri(rustdeskId, password) {
  const id = (rustdeskId || '').trim().replace(/\s+/g, '')
  return `rustdesk://${id}${password ? `?password=${encodeURIComponent(password)}` : ''}`
}
