import type { DataAdapter } from './DataAdapter'
import { createDemoAdapter } from './demoAdapter'
import { createSupabaseAdapter } from './supabaseAdapter'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Supabase when both env vars are present; the zero-setup demo otherwise. */
export const api: DataAdapter = url && key ? createSupabaseAdapter(url, key) : createDemoAdapter()

export { DEMO_INVITE_CODE } from './demoAdapter'
