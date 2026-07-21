import type { City } from '../lib/api/types'

export const SEED_CITIES: City[] = [
  { id: 'antwerp', name: 'Antwerp', country: 'Belgium', centerLat: 51.2172, centerLng: 4.4078, defaultZoom: 13 },
  { id: 'istanbul', name: 'Istanbul', country: 'Türkiye', centerLat: 41.028, centerLng: 28.9784, defaultZoom: 12 },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', centerLat: 35.6712, centerLng: 139.7203, defaultZoom: 12 },
  { id: 'seoul', name: 'Seoul', country: 'South Korea', centerLat: 37.5519, centerLng: 126.9918, defaultZoom: 12 },
  { id: 'paris', name: 'Paris', country: 'France', centerLat: 48.8646, centerLng: 2.3522, defaultZoom: 13 },
]
