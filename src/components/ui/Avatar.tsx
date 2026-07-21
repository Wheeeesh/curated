import type { Profile } from '../../lib/api/types'
import { initials } from '../../lib/format'

/**
 * Member colour is kept here on purpose: it is identity information that
 * makes people recognisable when scanning a list.
 */
export function Avatar({ profile, size = 40 }: { profile: Profile; size?: number }) {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        letterSpacing: '-0.02em',
        color: profile.avatarColor,
        backgroundColor: `${profile.avatarColor}1f`,
      }}
    >
      {initials(profile.displayName)}
    </div>
  )
}
