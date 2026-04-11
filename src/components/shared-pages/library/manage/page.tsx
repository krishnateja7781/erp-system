import { GoogleBooksSearch } from '@/components/library/google-books-search';
import { getSession } from '@/actions/auth-actions';
import { redirect } from 'next/navigation';

export default async function LibraryManagePage() {
  const { data } = await getSession();
  const role = data?.profile?.role;

  if (role !== 'super_admin' && role !== 'employee') {
    redirect('/unauthorized');
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Books Catalog</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Search the global Google Books repository and instantly import titles, metadata, and covers into our local school library.
        </p>
      </div>

      <div className="bg-muted/10 p-6 rounded-xl border">
        <GoogleBooksSearch />
      </div>
    </div>
  );
}
