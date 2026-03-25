import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceRoleClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const response = NextResponse.json({ success: true }) // temporary — will rebuild below

  // Build a Supabase client that reads/writes cookies on this exact response object
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Ignore incoming cookies during login to prevent SSR from attempting
          // to refresh a dead or stale session token before generating the new one.
          return []
        },
        setAll(cookiesToSet) {
          // We set cookies on the response — this is what makes them available immediately
          // in the browser once the response is received (before any JS runs)
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: authError?.message || 'Invalid email or password.' },
      { status: 401 }
    )
  }

  // Read the profile to get the role for client-side redirect decision
  // We use the service_role key here because the `supabase` instance
  // above doesn't internally register the new session immediately for the next query.
  // We MUST use the raw @supabase/supabase-js client, NOT createServerClient from SSR,
  // because the SSR client will read old cookies and override the Service Role Key!
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    }
  )

  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', authData.user.id)
    .single()

  if (profileError || !profile) {
    // Auth succeeded but no profile — likely a Supabase auth user with no corresponding profile row
    return NextResponse.json(
      { 
        error: 'Your account was found but no profile exists. Please contact the administrator to set up your account.' 
      },
      { status: 403 }
    )
  }

  // Return the role so the client can decide where to redirect
  // The session cookies are already set in `response.cookies` above
  const finalResponse = NextResponse.json({
    success: true,
    role: profile.role,
    name: profile.full_name,
  })

  // Copy the session cookies from the intermediate response to the final response
  response.cookies.getAll().forEach(cookie => {
    finalResponse.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly ?? true,
      secure: cookie.secure ?? process.env.NODE_ENV === 'production',
      sameSite: (cookie.sameSite as any) ?? 'lax',
      path: cookie.path ?? '/',
      maxAge: cookie.maxAge,
    })
  })

  return finalResponse
}
