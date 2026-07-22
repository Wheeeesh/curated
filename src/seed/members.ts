import type { Category, Profile } from '../lib/api/types'
import { memberId, seedDate } from './ids'

export interface PersonaBias {
  /** Added to every score before clamping (generosity / harshness). */
  meanOffset: number
  /** How many seed reviews this persona writes. */
  reviewCount: number
  /** Cities they review in besides their home city. */
  travelsTo: string[]
}

export interface SeedMember extends Profile {
  bias: PersonaBias
  /** usernames of members this persona follows */
  follows: string[]
  /** persona-voiced review fragments the generator stitches together */
  voice: { praise: string[]; mixed: string[]; short: string[] }
}

const m = (n: number, p: Omit<SeedMember, 'id' | 'isAdmin' | 'invitedBy' | 'onboarded' | 'isSeed' | 'createdAt'>): SeedMember => ({
  id: memberId(n),
  isAdmin: false,
  invitedBy: null,
  onboarded: true,
  isSeed: true,
  createdAt: seedDate(200 - n * 6),
  ...p,
})

/**
 * Eight personas in two loose taste clusters — a nightlife cluster
 * (elif / dae / vera) and a culture-food cluster (mika / jules / sam) —
 * bridged by ken, with nora orbiting nature/calm. The clusters make the
 * similarity math visibly structured in the demo.
 */
export const SEED_MEMBERS: SeedMember[] = [
  m(1, {
    username: 'mika', displayName: 'Mika Ashida', avatarColor: '#e0765c',
    bio: 'Eats first, asks later. Tokyo born, always hungry.',
    interests: ['food', 'bars', 'culture'], homeCity: 'tokyo',
    follows: ['jules', 'sam', 'ken', 'elif'],
    bias: { meanOffset: 0, reviewCount: 18, travelsTo: ['seoul', 'paris'] },
    voice: {
      praise: [
        'The kind of place you measure everything else against afterwards.',
        'Precision without fuss. I went back the next day, which says everything.',
        'Every detail considered, nothing performed. Rare.',
      ],
      mixed: [
        'Very good, not transcendent — but the room carries it further than it should.',
        'Solid execution, though I suspect the hype arrived slightly before the kitchen did.',
      ],
      short: ['Worth the detour.', 'Quietly excellent.', 'Book ahead, thank me later.'],
    },
  }),
  m(2, {
    username: 'elif', displayName: 'Elif Kaya', avatarColor: '#6e8fe0',
    bio: 'Istanbul after midnight. If the sound system is bad, I leave.',
    interests: ['nightlife', 'music', 'bars'], homeCity: 'istanbul',
    follows: ['dae', 'vera', 'ken'],
    bias: { meanOffset: 0, reviewCount: 16, travelsTo: ['paris', 'antwerp'] },
    voice: {
      praise: [
        'The room breathes with the music. Stayed until they turned the lights on.',
        'Crowd was exactly right — nobody filming, everybody dancing.',
        'This is what a night out is supposed to feel like.',
      ],
      mixed: [
        'Great sound, slightly self-conscious crowd. Go late, not early.',
        'Loved the energy, less convinced by the door policy.',
      ],
      short: ['Go on a Thursday.', 'Trust me on this one.', 'Loud in the right way.'],
    },
  }),
  m(3, {
    username: 'jules', displayName: 'Jules Marchand', avatarColor: '#ce7ba0',
    bio: 'Paris. Museums before noon, natural wine after.',
    interests: ['culture', 'food', 'shopping'], homeCity: 'paris',
    follows: ['mika', 'sam', 'nora'],
    bias: { meanOffset: -1, reviewCount: 15, travelsTo: ['antwerp', 'tokyo'] },
    voice: {
      praise: [
        'One resists the word flawless, and yet. The curation alone justifies the visit.',
        'It earns its reputation the honest way — by being better than it needs to be.',
        'A serious place for people who take pleasure seriously.',
      ],
      mixed: [
        'Admirable, if a touch pleased with itself. The substance survives the styling.',
        'Fine work, though one senses the concept arrived before the conviction.',
      ],
      short: ['Better than it needs to be.', 'Go before everyone else does.', 'Justified.'],
    },
  }),
  m(4, {
    username: 'nora', displayName: 'Nora Willems', avatarColor: '#7fa46b',
    bio: 'Antwerp. Parks, quiet corners, honest coffee. Allergic to tourist traps.',
    interests: ['nature', 'food', 'culture'], homeCity: 'antwerp',
    follows: ['jules', 'ken', 'mika'],
    bias: { meanOffset: 0, reviewCount: 14, travelsTo: ['paris', 'istanbul'] },
    voice: {
      praise: [
        'Peaceful, unpretentious, and exactly what it says it is. I keep coming back.',
        'The sort of spot locals guard jealously. Now you know too.',
        'Nothing here is trying to impress you, which is why it does.',
      ],
      mixed: [
        'Lovely at off-hours; weekends are another story entirely.',
        'Good bones, slightly worn edges. Still worth your morning.',
      ],
      short: ['Go early, on foot.', 'Bring a book.', 'Exactly as promised.'],
    },
  }),
  m(5, {
    username: 'dae', displayName: 'Dae Park', avatarColor: '#a184d6',
    bio: 'Seoul. Basements, line-ups, records. Price is irrelevant when the lineup is right.',
    interests: ['music', 'nightlife', 'bars'], homeCity: 'seoul',
    follows: ['elif', 'vera', 'ken', 'mika'],
    bias: { meanOffset: 0, reviewCount: 16, travelsTo: ['tokyo', 'istanbul'] },
    voice: {
      praise: [
        'Booking is consistently ahead of the curve. This room has taste.',
        'Sound engineering that respects the artist and the crowd alike.',
        'Left with three new artists in my library. That is the whole point.',
      ],
      mixed: [
        'Strong nights when the resident plays; guest slots are a coin flip.',
        'The room is better than the average booking deserves.',
      ],
      short: ['Check the lineup first.', 'The good kind of basement.', 'Respect.'],
    },
  }),
  m(6, {
    username: 'sam', displayName: 'Sam Okafor', avatarColor: '#58b5a4',
    bio: 'Paris via Lagos. Brunch strategist, vintage hunter, easily delighted.',
    interests: ['shopping', 'food', 'bars'], homeCity: 'paris',
    follows: ['jules', 'mika', 'nora', 'elif'],
    bias: { meanOffset: 1, reviewCount: 15, travelsTo: ['antwerp', 'seoul'] },
    voice: {
      praise: [
        'An absolute joy from the first minute. The staff remembered my name on visit two!',
        'I have sent four friends here already and every one of them thanked me.',
        'Came for an hour, stayed for three. Zero regrets.',
      ],
      mixed: [
        'So charming that I forgive the wait. Mostly.',
        'A little chaotic on Saturdays but the finds are real.',
      ],
      short: ['A gem, honestly.', 'Ran here, tell no one.', 'Instant favourite.'],
    },
  }),
  m(7, {
    username: 'vera', displayName: 'Vera Jacobs', avatarColor: '#d9a441',
    bio: 'Antwerp bartender. I know what a fair pour costs. Value is a skill.',
    interests: ['bars', 'nightlife', 'food'], homeCity: 'antwerp',
    follows: ['elif', 'dae', 'sam'],
    bias: { meanOffset: 0, reviewCount: 14, travelsTo: ['istanbul', 'paris'] },
    voice: {
      praise: [
        'Honest pours, fair prices, staff who actually taste what they serve.',
        'The bill was almost suspiciously reasonable for this quality. Cherish it.',
        'This is how you run a bar. Take notes, everyone else.',
      ],
      mixed: [
        'Great drinks, tourist pricing creeping in. Watching this one closely.',
        'Skilled bar, but the margins are doing a lot of talking lately.',
      ],
      short: ['Fair. Rare thing.', 'Order the house special.', 'Good value, good people.'],
    },
  }),
  m(8, {
    username: 'ken', displayName: 'Ken Watanabe', avatarColor: '#a89c85',
    bio: 'Tokyo. A little of everything, strong opinions about nothing. The reliable second opinion.',
    interests: ['culture', 'nature', 'food', 'music'], homeCity: 'tokyo',
    follows: ['mika', 'elif', 'jules', 'nora', 'dae'],
    bias: { meanOffset: 0, reviewCount: 17, travelsTo: ['seoul', 'antwerp', 'paris'] },
    voice: {
      praise: [
        'Does what it does very well, without needing you to notice how hard that is.',
        'Consistent every single visit. Consistency is underrated.',
        'A safe recommendation for almost anyone, which is harder than it sounds.',
      ],
      mixed: [
        'Good, with occasional flashes of great. Depends on the day.',
        'Perfectly solid. Manage your expectations and it over-delivers.',
      ],
      short: ['Reliably good.', 'No surprises, all of them pleasant.', 'Would return.'],
    },
  }),
]

export const memberByUsername = Object.fromEntries(SEED_MEMBERS.map((mm) => [mm.username, mm]))

export const SEED_FOLLOWS = SEED_MEMBERS.flatMap((mm) =>
  mm.follows.map((u) => ({ followerId: mm.id, followeeId: memberByUsername[u].id })),
)

export const seedInterestsFor = (username: string): Category[] => memberByUsername[username].interests
