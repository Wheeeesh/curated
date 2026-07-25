/**
 * Hand-curated, best-in-kind venues — the atlas's own editorial picks.
 *
 * Unlike the scraped sources, this file is written by hand and committed: it
 * is the source of truth. `scripts/import-curated.ts` geocodes each entry
 * through open geodata and writes scripts/data/curated-places.json for the
 * merge, exactly like every other source.
 *
 * The rule for inclusion is "the best at what it does" — not the most
 * expensive. A legendary two-euro souvlaki counts; a place is here on the
 * merit of its craft, never its price tag. Anything that could not be
 * verified as real and correctly located was left out rather than guessed.
 *
 * `geocodeAs` overrides the search string for names too generic to resolve on
 * their own ("Line" is a bar, not a shape).
 */
export interface CuratedVenue {
  name: string
  categories: string[]
  city: string
  country: string
  /** Village or neighbourhood, to pin the right one. */
  area?: string
  /** Explicit geocoder query when the name alone is ambiguous. */
  geocodeAs?: string
  /**
   * Hand-set coordinates, bypassing the geocoder. For landmarks the geocoder
   * can't resolve or resolves to the wrong same-named place. Still distance-
   * checked against the city centre, so a fat-fingered value is caught.
   */
  lat?: number
  lng?: number
}

export interface CityCenter {
  lat: number
  lng: number
  /** A result further than this from the centre is treated as a mis-geocode. */
  radiusKm: number
}

/** Bias and sanity-check the geocoder against the right place on earth. */
export const CITY_CENTERS: Record<string, CityCenter> = {
  Tinos: { lat: 37.5395, lng: 25.162, radiusKm: 32 }, // island runs Chora → Pyrgos
  Athens: { lat: 37.9755, lng: 23.7348, radiusKm: 30 },
  Madrid: { lat: 40.4169, lng: -3.7035, radiusKm: 28 },
  'Knokke-Heist': { lat: 51.3472, lng: 3.2861, radiusKm: 16 },
}

export const CURATED_VENUES: CuratedVenue[] = [
  // ——————————————————————— Tinos, Greece ———————————————————————
  // A Cycladic island that has quietly become one of Greece's great eating
  // destinations, on top of a living marble-carving tradition (UNESCO-listed).
  { name: 'To Thalassaki', categories: ['food'], city: 'Tinos', country: 'Greece', area: 'Isternia', geocodeAs: 'To Thalassaki Tinos Greece' }, // seaside taverna widely called the island's best
  { name: 'San to Alati', categories: ['food'], city: 'Tinos', country: 'Greece', area: 'Agios Fokas' }, // Aegean cuisine on the beach, all local produce
  { name: 'Marathia', categories: ['food'], city: 'Tinos', country: 'Greece', area: 'Agios Fokas', geocodeAs: 'Marathia restaurant Tinos Greece' }, // beachfront, meticulously local
  { name: 'Pantopoleio Tereza', categories: ['food'], city: 'Tinos', country: 'Greece', area: 'Myrsini', geocodeAs: 'Tereza Myrsini Tinos Greece' }, // village grocer-taverna, famous kopanisti and marathokeftedes
  { name: 'Museum of Marble Crafts', categories: ['culture', 'artisan'], city: 'Tinos', country: 'Greece', area: 'Pyrgos' }, // definitive account of the island's marble craft
  { name: 'Panagia Evangelistria', categories: ['culture'], city: 'Tinos', country: 'Greece', area: 'Chora', lat: 37.5448, lng: 25.1618 }, // the great Greek Orthodox pilgrimage church
  { name: 'Kolimbithra Beach', categories: ['nature'], city: 'Tinos', country: 'Greece', lat: 37.6072, lng: 25.144 }, // the island's finest beach and only surf spot

  // ——————————————————————— Athens, Greece ———————————————————————
  { name: 'Line', categories: ['bars'], city: 'Athens', country: 'Greece', lat: 37.9774, lng: 23.733 }, // Europe's Best Bar 2026; a former gallery making everything from scratch
  { name: 'The Clumsies', categories: ['bars'], city: 'Athens', country: 'Greece', geocodeAs: 'The Clumsies Athens Greece' }, // perennial World's 50 Best
  { name: 'Baba au Rum', categories: ['bars'], city: 'Athens', country: 'Greece', geocodeAs: 'Baba au Rum Athens Greece' }, // rum temple, World's 50 Best
  { name: 'Taf Coffee', categories: ['coffee'], city: 'Athens', country: 'Greece', geocodeAs: 'TAF Athens Greece' }, // multi-award-winning specialty roaster
  { name: 'O Kostas', categories: ['food'], city: 'Athens', country: 'Greece', area: 'Syntagma', lat: 37.9759, lng: 23.7316 }, // a 70-year-old souvlaki bar off Mitropoleos, still the benchmark
  { name: 'O Thanasis', categories: ['food'], city: 'Athens', country: 'Greece', geocodeAs: 'O Thanasis Monastiraki Athens Greece' }, // the Monastiraki kebab institution
  { name: 'Karamanlidika tou Fani', categories: ['food'], city: 'Athens', country: 'Greece', geocodeAs: 'Karamanlidika Athens Greece' }, // deli-charcuterie-taverna, Cappadocian Greek cooking
  { name: 'Diporto', categories: ['food'], city: 'Athens', country: 'Greece', geocodeAs: 'Diporto Athens Greece' }, // no sign, no menu, unchanged since 1887
  { name: 'Nolan', categories: ['food'], city: 'Athens', country: 'Greece', geocodeAs: 'Nolan Athens Greece' }, // modern Greek with a Japanese hand
  { name: 'Acropolis Museum', categories: ['culture'], city: 'Athens', country: 'Greece', geocodeAs: 'Acropolis Museum Athens Greece' },
  { name: 'Benaki Museum', categories: ['culture', 'art'], city: 'Athens', country: 'Greece', geocodeAs: 'Benaki Museum Athens Greece' },
  { name: 'Stavros Niarchos Foundation Cultural Center', categories: ['culture', 'nature'], city: 'Athens', country: 'Greece', geocodeAs: 'Stavros Niarchos Foundation Cultural Center Athens Greece' },
  { name: 'National Garden', categories: ['nature'], city: 'Athens', country: 'Greece', geocodeAs: 'National Garden Athens Greece' },
  { name: 'Lycabettus Hill', categories: ['nature'], city: 'Athens', country: 'Greece', geocodeAs: 'Lycabettus Athens Greece' },

  // ——————————————————————— Madrid, Spain ———————————————————————
  { name: 'Casa Dani', categories: ['food'], city: 'Madrid', country: 'Spain', geocodeAs: 'Casa Dani Mercado de la Paz Madrid Spain' }, // officially the best tortilla in Madrid
  { name: 'Sacha', categories: ['food'], city: 'Madrid', country: 'Spain', geocodeAs: 'Sacha Madrid Spain' }, // the chefs' cult bistro since 1972
  { name: 'Bar La Campana', categories: ['food'], city: 'Madrid', country: 'Spain', geocodeAs: 'Bar La Campana Botoneras Madrid Spain' }, // the reference bocadillo de calamares
  { name: 'Casa Julio', categories: ['food'], city: 'Madrid', country: 'Spain', geocodeAs: 'Casa Julio Calle de la Madera Madrid Spain' }, // legendary croquetas, Malasaña
  { name: 'Taberna La Ardosa', categories: ['bars', 'food'], city: 'Madrid', country: 'Spain', geocodeAs: 'Taberna La Ardosa Madrid Spain' }, // 1892 taberna, salmorejo and vermouth
  { name: 'Botín', categories: ['food', 'culture'], city: 'Madrid', country: 'Spain', geocodeAs: 'Restaurante Botin Cuchilleros Madrid Spain' }, // the world's oldest restaurant, 1725
  { name: 'Salmón Guru', categories: ['bars'], city: 'Madrid', country: 'Spain', geocodeAs: 'Salmon Guru Echegaray Madrid Spain' }, // Diego Cabrera, World's 50 Best Bars
  { name: '1862 Dry Bar', categories: ['bars'], city: 'Madrid', country: 'Spain', geocodeAs: '1862 Dry Bar Calle del Pez Madrid Spain' }, // classic cocktails done immaculately
  { name: 'HanSo Café', categories: ['coffee'], city: 'Madrid', country: 'Spain', geocodeAs: 'HanSo Cafe Calle del Pez Madrid Spain' }, // specialty coffee and pastry benchmark
  { name: 'Toma Café', categories: ['coffee'], city: 'Madrid', country: 'Spain', geocodeAs: 'Toma Cafe Calle de la Palma Madrid Spain' }, // Madrid's first specialty coffee bar
  { name: 'Corral de la Morería', categories: ['music'], city: 'Madrid', country: 'Spain', geocodeAs: 'Corral de la Moreria Madrid Spain' }, // the world's foremost flamenco tablao
  { name: 'Casa Hernanz', categories: ['artisan', 'shopping'], city: 'Madrid', country: 'Spain', geocodeAs: 'Casa Hernanz Calle de Toledo Madrid Spain' }, // hand-made espadrilles since 1845
  { name: 'Museo del Prado', categories: ['art', 'culture'], city: 'Madrid', country: 'Spain', geocodeAs: 'Museo del Prado Madrid Spain' },
  { name: 'Museo Reina Sofía', categories: ['art', 'culture'], city: 'Madrid', country: 'Spain', geocodeAs: 'Museo Reina Sofia Madrid Spain' },
  { name: 'Museo Thyssen-Bornemisza', categories: ['art', 'culture'], city: 'Madrid', country: 'Spain', geocodeAs: 'Museo Thyssen-Bornemisza Madrid Spain' },
  { name: 'Parque del Retiro', categories: ['nature'], city: 'Madrid', country: 'Spain', geocodeAs: 'Parque del Retiro Madrid Spain' },
  { name: 'El Rastro', categories: ['shopping'], city: 'Madrid', country: 'Spain', geocodeAs: 'El Rastro Ribera de Curtidores Madrid Spain' }, // the historic Sunday flea market
  { name: 'Matadero Madrid', categories: ['art', 'culture'], city: 'Madrid', country: 'Spain', geocodeAs: 'Matadero Madrid Legazpi Madrid Spain' }, // the city's contemporary-arts powerhouse

  // ——————————————————————— Knokke-Heist, Belgium ———————————————————————
  // A resort town — so the pick is craft-first, not price-first.
  { name: 'Sel Gris', categories: ['food'], city: 'Knokke-Heist', country: 'Belgium', area: 'Duinbergen', geocodeAs: 'Sel Gris Duinbergen Knokke-Heist Belgium' }, // Michelin-starred, here on cooking alone, over the sea
  { name: 'Café de Paris', categories: ['food'], city: 'Knokke-Heist', country: 'Belgium', geocodeAs: 'Cafe de Paris Knokke Belgium' }, // the town's beloved French bistro
  { name: 'Guy Pieters Gallery', categories: ['art'], city: 'Knokke-Heist', country: 'Belgium', geocodeAs: 'Zeedijk-Knokke 775 Knokke-Heist Belgium' }, // internationally significant modern/pop art
  { name: 'Zwin Nature Park', categories: ['nature'], city: 'Knokke-Heist', country: 'Belgium', geocodeAs: 'Zwin Nature Park Knokke-Heist Belgium' }, // Belgium's first nature reserve, a landmark bird sanctuary
]
