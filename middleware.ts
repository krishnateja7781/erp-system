import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DASHBOARD: Record<string, string> = {
  super_admin: '/admin/dashboard',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
  employee: '/employee/dashboard',
}

/** Each employee department may only reach its own module (plus the shared pages below). */
const EMPLOYEE_MODULES: Record<string, string[]> = {
  fee_management: ['/employee/fees'],
  hostel_management: ['/employee/hostel'],
  student_staff_management: ['/employee/users', '/employee/students', '/employee/teachers'],
  exam_marks_management: ['/employee/exams'],
  library_management: ['/employee/library'],
}
const EMPLOYEE_SHARED = ['/employee/dashboard', '/employee/notifications', '/employee/settings']

const AUTH_PAGES = ['/login', '/signup', '/admin-signup', '/forgot-password']
const PUBLIC_PAGES = ['/unauthorized', '/auth/callback']

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p + '/'))

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return new NextResponse('Server misconfigured: Supabase environment variables are missing.', { status: 500 })
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const pathname = request.nextUrl.pathname
  if (startsWithAny(pathname, PUBLIC_PAGES)) return response

  // getUser() validates the JWT with Supabase Auth (never trust the cookie alone).
  const { data: { user } } = await supabase.auth.getUser()

  /**
   * Role and employee department are mirrored into app_metadata by a DB trigger
   * (see database/schema.sql → sync_auth_claims), so the common path needs no
   * extra query. Fallback to the tables for accounts created before the trigger.
   */
  let role: string | undefined = user?.app_metadata?.role
  let employeeType: string | undefined = user?.app_metadata?.employee_type
  if (user && !role) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    role = profile?.role
  }

  const redirect = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url))
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  if (startsWithAny(pathname, AUTH_PAGES)) {
    if (user && role && DASHBOARD[role]) return redirect(DASHBOARD[role])
    return response
  }

  if (!user) {
    const login = new URL('/login', request.url)
    if (pathname !== '/') login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }
  if (!role || !DASHBOARD[role]) return redirect('/unauthorized')

  if (pathname === '/') return redirect(DASHBOARD[role])

  // Routes any signed-in user may open.
  if (startsWithAny(pathname, ['/settings', '/library', '/update-password'])) return response

  if (role === 'super_admin') {
    return pathname.startsWith('/admin') ? response : redirect(DASHBOARD.super_admin)
  }
  if (role === 'teacher') {
    return pathname.startsWith('/teacher') || pathname.startsWith('/classrooms') ? response : redirect(DASHBOARD.teacher)
  }
  if (role === 'student') {
    return pathname.startsWith('/student') || pathname.startsWith('/classrooms') ? response : redirect(DASHBOARD.student)
  }

  // Employee
  if (!pathname.startsWith('/employee')) return redirect(DASHBOARD.employee)
  if (startsWithAny(pathname, EMPLOYEE_SHARED)) return response

  if (!employeeType) {
    const { data: emp } = await supabase.from('employees').select('employee_type').eq('profile_id', user.id).maybeSingle()
    employeeType = emp?.employee_type ?? undefined
  }
  if (!employeeType || !EMPLOYEE_MODULES[employeeType]) return redirect('/unauthorized')
  return startsWithAny(pathname, EMPLOYEE_MODULES[employeeType]) ? response : redirect(DASHBOARD.employee)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
