import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Icon from '../components/Icon'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [recentScans, setRecentScans] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        navigate('/auth')
        return
      }

      const [{ data: profileData }, { data: subData }, { data: scans }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
        supabase
          .from('meal_scans')
          .select('id, meal_name, calories, estimated_sugar_g, created_at, status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (!active) return
      setProfile(profileData)
      setSubscription(subData)
      setRecentScans(scans ?? [])
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center text-gray-400">
        Loading your dashboard…
      </div>
    )
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const scansRemaining = subscription?.scans_remaining ?? 0
  const plan = subscription?.plan ?? 'free'

  return (
    <div className="min-h-screen bg-brand-50 pb-24">
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Good morning, {firstName}.</h1>
        <p className="text-gray-500 mt-1">Your food insights are one scan away.</p>
      </div>

      <div className="px-6 grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Remaining scans" value={scansRemaining} suffix="left" />
        <StatCard label="Plan" value={plan === 'pro' ? 'Pro' : 'Free'} />
      </div>

      <div className="px-6 mb-6">
        <button
          onClick={() => navigate('/scan')}
          disabled={scansRemaining <= 0}
          className="w-full bg-white border-2 border-dashed border-brand-300 rounded-3xl py-10 flex flex-col items-center justify-center gap-3 disabled:opacity-50"
        >
          <div className="w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center">
            <Icon name="photo_camera" size={26} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">
              {scansRemaining > 0 ? 'Scan Meal' : 'No scans remaining'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {scansRemaining > 0
                ? 'Upload or capture a photo of your food'
                : 'Upgrade to Pro to keep scanning'}
            </p>
          </div>
        </button>
      </div>

      <div className="px-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Scans</h2>
          <button
            onClick={() => navigate('/history')}
            className="text-sm text-brand-600 font-medium"
          >
            View All
          </button>
        </div>

        {recentScans.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm">
            No scans yet — your first one will show up here.
          </div>
        ) : (
          <div className="space-y-3">
            {recentScans.map((scan) => (
              <div
                key={scan.id}
                className="bg-white rounded-2xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {scan.meal_name || 'Untitled meal'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(scan.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  {scan.calories != null && (
                    <Pill>{Math.round(scan.calories)} kcal</Pill>
                  )}
                  {scan.estimated_sugar_g != null && (
                    <Pill>{scan.estimated_sugar_g}g sugar</Pill>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, suffix }) {
  return (
    <div className="bg-white rounded-2xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {value} {suffix && <span className="text-sm font-normal text-gray-400">{suffix}</span>}
      </p>
    </div>
  )
}

function Pill({ children }) {
  return (
    <span className="text-xs font-medium bg-brand-50 text-brand-700 rounded-full px-2.5 py-1">
      {children}
    </span>
  )
}
