import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next()
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // ── Auth pages: redirect logged-in users to their dashboard ──
  const isAuthPage = pathname.startsWith('/login') ||
                     pathname.startsWith('/signup') ||
                     pathname.startsWith('/admin-signup') ||
                     pathname.startsWith('/forgot-password')

  if (isAuthPage) {
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'super_admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      if (profile?.role === 'teacher')     return NextResponse.redirect(new URL('/teacher/dashboard', request.url))
      if (profile?.role === 'student')     return NextResponse.redirect(new URL('/student/dashboard', request.url))
      if (profile?.role === 'employee')    return NextResponse.redirect(new URL('/employee/dashboard', request.url))
    }
    return supabaseResponse
  }

  // ── Public pages accessible without login ──
  if (pathname.startsWith('/unauthorized')) {
    return supabaseResponse
  }

  // ── All other routes require an authenticated session ──
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── Fetch user role ──
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile?.role) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  const role = profile.role

  // ── Root "/" → redirect to correct dashboard ──
  if (pathname === '/') {
    if (role === 'super_admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    if (role === 'teacher')     return NextResponse.redirect(new URL('/teacher/dashboard', request.url))
    if (role === 'student')     return NextResponse.redirect(new URL('/student/dashboard', request.url))
    if (role === 'employee')    return NextResponse.redirect(new URL('/employee/dashboard', request.url))
  }

  // ── Global routes always allowed for any authenticated user ──
  const isGlobalRoute = pathname.startsWith('/settings') ||
                        pathname.startsWith('/classrooms') ||
                        pathname.startsWith('/library')
  if (isGlobalRoute) return supabaseResponse

  // ── Super Admin: can reach any /admin/* route ──
  if (role === 'super_admin') {
    if (pathname.startsWith('/admin')) return supabaseResponse
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // ── Teacher ──
  if (role === 'teacher') {
    if (pathname.startsWith('/teacher')) return supabaseResponse
    return NextResponse.redirect(new URL('/teacher/dashboard', request.url))
  }

  // ── Student ──
  if (role === 'student') {
    if (pathname.startsWith('/student')) return supabaseResponse
    return NextResponse.redirect(new URL('/student/dashboard', request.url))
  }

  // ── Employee: route based on employee_type ──
  if (role === 'employee') {
    // All employees share the dashboard
    if (pathname.startsWith('/employee/dashboard')) return supabaseResponse

    const { data: employee } = await supabase
      .from('employees')
      .select('employee_type')
      .eq('profile_id', user.id)
      .single()

    if (!employee?.employee_type) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    const empType = employee.employee_type

    const employeeRouteMap: Record<string, string> = {
      fee_management:           '/employee/fees',
      hostel_management:        '/employee/hostel',
      student_staff_management: '/employee/users',
      exam_marks_management:    '/employee/exams',
      library_management:       '/employee/library',
    }

    const allowedBase = employeeRouteMap[empType]
    if (allowedBase && pathname.startsWith(allowedBase)) return supabaseResponse

    // Allow any other /employee/* sub-route (shared components, settings etc.)
    if (pathname.startsWith('/employee')) return supabaseResponse

    return NextResponse.redirect(new URL('/employee/dashboard', request.url))
  }

  // ── Catch-all: unknown role ──
  return NextResponse.redirect(new URL('/unauthorized', request.url))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
