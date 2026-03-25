import * as React from 'react';
import Link from 'next/link';
import { BookOpen, Search, Settings } from 'lucide-react';
import { getSession } from '@/actions/auth-actions';

export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  const { data } = await getSession();
  const profile = data?.profile;
  const isAdminOrEmployee = profile?.role === 'super_admin' || profile?.role === 'employee';

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 border-b lg:border-r border-border bg-muted/20 pb-4 lg:pb-0">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight mb-6">Library</h2>
          <nav className="space-y-2">
            <Link 
              href="/library" 
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <BookOpen className="h-4 w-4" />
              School Catalog
            </Link>

            {isAdminOrEmployee && (
              <>
                <div className="pt-4 pb-2">
                  <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Librarian Tools
                  </span>
                </div>
                <Link 
                  href="/library/manage" 
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Search className="h-4 w-4" />
                  Import from Google
                </Link>
                <Link 
                  href="/employee/library" 
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Settings className="h-4 w-4" />
                  Manage Inventory
                </Link>
              </>
            )}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
