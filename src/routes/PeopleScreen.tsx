import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFollowMutation, useFollows, useMembers, useMyProfile, useTasteEngine } from '../lib/hooks'
import { Avatar } from '../components/ui/Avatar'

export function PeopleScreen() {
  const { data: members } = useMembers()
  const { data: follows } = useFollows()
  const { data: me } = useMyProfile()
  const engine = useTasteEngine()
  const followMutation = useFollowMutation()

  const [tab, setTab] = useState<'all' | 'following'>('all')
  const [query, setQuery] = useState('')

  const iFollow = useMemo(
    () => new Set((follows ?? []).filter((f) => f.followerId === me?.id).map((f) => f.followeeId)),
    [follows, me?.id],
  )

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (members ?? [])
      .filter((m) => m.id !== me?.id && m.onboarded)
      .filter((m) => tab === 'all' || iFollow.has(m.id))
      .filter((m) => !q || m.displayName.toLowerCase().includes(q) || m.username.includes(q))
      .map((m) => ({ member: m, sim: engine ? engine.similarityTo(m.id) : 0 }))
      .sort((a, b) => b.sim - a.sim)
  }, [members, me?.id, tab, query, iFollow, engine])

  return (
    <div className="h-full overflow-y-auto bg-bg pb-24 land:pb-8 land:pl-[72px]">
      <div className="glass sticky top-0 z-20 space-y-3 border-b border-separator px-4 pb-3 pt-12">
        <h1 className="t-large-title">Members</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="field !min-h-[38px] !py-2 bg-fill"
          aria-label="Search members"
        />
        <div className="segmented">
          {(
            [
              ['all', 'Everyone'],
              ['following', 'Your circle'],
            ] as const
          ).map(([t, label]) => (
            <button key={t} type="button" data-on={tab === t} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 land:mx-auto land:max-w-2xl">
        {list.length === 0 ? (
          <p className="pt-10 text-center t-subhead text-label-2">
            {tab === 'following' ? 'Nobody in your circle yet.' : 'No members found.'}
          </p>
        ) : (
          <div className="ios-group">
            {list.map(({ member, sim }) => {
              const on = iFollow.has(member.id)
              return (
                <div key={member.id} className="ios-row ios-row-inset-avatar">
                  <Link to={`/user/${member.id}`} className="pressable flex min-w-0 flex-1 items-center gap-3">
                    <Avatar profile={member} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate t-body font-medium">{member.displayName}</span>
                      <span className="block truncate t-footnote text-label-2">
                        {Math.round(sim * 100)}% taste match
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    disabled={followMutation.isPending}
                    onClick={() => followMutation.mutate({ userId: member.id, on: !on })}
                    className={`pressable min-h-[32px] shrink-0 rounded-full px-4 text-[14px] font-semibold ${
                      on ? 'bg-fill text-label' : 'bg-accent text-white'
                    }`}
                  >
                    {on ? 'Following' : 'Follow'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
