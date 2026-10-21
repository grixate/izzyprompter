export const archivedSkins = [
  { id: 'original', number: '00', name: 'Original', material: 'Knurled graphite', note: 'The familiar instrument. Made for every take.', pro: false },
  { id: 'ivory', number: '03', name: 'Orbit', material: 'Warm ceramic', note: 'A quiet ring. One orange index. Nothing extra.', pro: true },
  { id: 'field', number: '01', name: 'Field reel', material: 'Satin aluminium', note: 'A broad machined disc, with room to find your rhythm.', pro: true },
  { id: 'graphite', number: '02', name: 'Thumbprint', material: 'Anodized graphite', note: 'A finger pocket and a little more grip.', pro: true },
  { id: 'signal', number: '04', name: 'Signal', material: 'Safety-orange enamel', note: 'A little broadcast equipment. A lot of character.', pro: true },
  { id: 'groove', number: '05', name: 'Groove', material: 'Smoked vinyl', note: 'Fine grooves. A warm centre. Studio soul.', pro: true },
  { id: 'glacier', number: '06', name: 'Glacier', material: 'Frosted polymer', note: 'Three pale spokes, caught in the light.', pro: true },
  { id: 'oxide', number: '07', name: 'Bakelite', material: 'Warm resin', note: 'A porcelain key in a vintage instrument.', pro: true },
  { id: 'switchboard', number: '08', name: 'Switchboard', material: 'Petrol enamel / ivory', note: 'An old conversation, with a new turn.', pro: true },
  { id: 'vector', number: '09', name: 'Vector', material: 'Phosphor / dark glass', note: 'A sweep of light beneath a fixed reticle.', pro: true },
  { id: 'cartridge', number: '10', name: 'Cartridge', material: 'Studio ABS', note: 'Blue ribs, a lavender key, and a playful edge.', pro: true },
  { id: 'aperture', number: '11', name: 'Aperture', material: 'Smoked optics', note: 'Six optical planes. One quiet opening.', pro: true },
  { id: 'correspondent', number: '12', name: 'Correspondent', material: 'Worn leather / brass', note: 'A field companion with a little history.', pro: true },
  { id: 'foundry', number: '13', name: 'Foundry', material: 'Cast bronze', note: 'Polished edges. Patina in the recesses.', pro: true },
  { id: 'inox', number: '14', name: 'Inox', material: 'Brushed stainless steel', note: 'Precision, down to the last seam.', pro: true },
  { id: 'airframe', number: '15', name: 'Airframe', material: 'Aviation aluminium', note: 'Material removed. Character retained.', pro: true },
  { id: 'clear', number: '16', name: 'Clear', material: 'Graphite glass / exposed coil', note: 'Smoked glass over a fixed graphite coil. The open white contour lights up when playback runs.', pro: true },
  { id: 'spool', number: '17', name: 'Spool', material: 'Smoked glass / copper coil', note: 'A transparent three-arm flange turns over a copper coil. One ivory hub holds the centre.', pro: true },
  { id: 'glaze', number: '18', name: 'Glaze', material: 'Blush glaze / porcelain', note: 'Soft glaze, a warm foot and a deep oxblood key.', pro: true },
  { id: 'pop', number: '19', name: 'Pop', material: 'Butter yellow / colour blocks', note: 'Big shapes. Bright colour. A little everyday joy.', pro: true },
  { id: 'moss', number: '20', name: 'Moss', material: 'Mineral green / walnut', note: 'A wooden rim around a quiet mineral centre.', pro: true },
  { id: 'mono', number: '21', name: 'Mono', material: 'Matte ink / chalk', note: 'A clean break in the circle. Everything in its place.', pro: true },
  { id: 'loom', number: '22', name: 'Loom', material: 'Woven oxblood / warm enamel', note: 'A woven case, a stitched edge and a smooth enamel dial.', pro: true },
  { id: 'arcade', number: '23', name: 'Arcade', material: 'Ivory ABS / violet paddle', note: 'A fluted silver spinner with a violet cap, a separate pink transport key and convex cabinet buttons.', pro: true },
  { id: 'observatory', number: '24', name: 'Observatory', material: 'Midnight enamel / brass', note: 'Orbital rings, a brass meridian and a small moving satellite.', pro: true },
  { id: 'rally', number: '25', name: 'Rally', material: 'Chalk enamel / competition rubber', note: 'A three-spoke steering wheel, a rubber grip and one centre key. A little classic motorsport.', pro: true },
] as const
export const selectedSkinIds = ['original','ivory','graphite','field','signal','groove','switchboard','vector','cartridge','correspondent','foundry','observatory','clear','arcade'] as const
export const skins = archivedSkins.filter(skin => (selectedSkinIds as readonly string[]).includes(skin.id))
export const proSkinCount = skins.filter(skin => skin.pro).length
export type SkinId = typeof archivedSkins[number]['id']
export const skinById = (id: unknown) => archivedSkins.find(skin => skin.id === id) ?? archivedSkins[0]
export const skinStorageKey = 'izzy:remote-finish:v1'
export function preferredSkin(): SkinId {
  try { return skins.find(skin => skin.id === localStorage.getItem(skinStorageKey))?.id ?? 'original' } catch { return 'original' }
}
export function saveSkin(id: SkinId): boolean {
  if (!skins.some(skin => skin.id === id)) return false
  try { localStorage.setItem(skinStorageKey, id); window.dispatchEvent(new Event('izzy:skin-change')); return true } catch { return false }
}

// Owner-directed control pass; archived studies stay available under their IDs.
export const controlCraftSkins: ReadonlySet<SkinId> = new Set(selectedSkinIds)
