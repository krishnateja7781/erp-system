// Route Segment Config: Force all pages under (app) to be dynamically rendered.
// This prevents Next.js from attempting to prerender pages that require
// runtime secrets (Supabase keys) during `npm run build`.
export const dynamic = 'force-dynamic';

export default function AppAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
