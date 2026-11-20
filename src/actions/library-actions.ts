'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, isUuid } from '@/lib/auth-guard';
import { fetchAllRows } from '@/lib/db';
import type { Book, ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const LIBRARIANS = ['emp:library_management'] as const;

function revalidateLibrary() {
  revalidatePath('/employee/library');
  revalidatePath('/admin/library');
  revalidatePath('/library');
}

export async function getBooks(): Promise<Book[]> {
  await requireRole();
  const admin = await createServiceRoleClient();
  return fetchAllRows<Book>(() => admin.from('books').select('*').order('title'));
}

export async function getBookById(id: string): Promise<Book | null> {
  await requireRole();
  if (!isUuid(id)) return null;
  const admin = await createServiceRoleClient();
  const { data } = await admin.from('books').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function addBook(bookData: Partial<Book>): Promise<ActionResult> {
  const auth = await authorize(...LIBRARIANS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!bookData?.title?.trim()) return { success: false, error: 'Title is required.' };
  const copies = Math.max(1, Number(bookData.total_copies) || 1);

  const admin = await createServiceRoleClient();
  const { error } = await admin.from('books').insert({
    title: bookData.title.trim(),
    isbn: bookData.isbn?.trim() || null,
    author: bookData.author || null,
    category: bookData.category || null,
    description: bookData.description || null,
    publisher: bookData.publisher || null,
    published_year: bookData.published_year || null,
    total_copies: copies,
    available_copies: copies,
    source: bookData.source || 'physical',
    digital_url: bookData.digital_url || null,
    added_by: auth.caller.userId,
  });
  if (error) return { success: false, error: error.code === '23505' ? 'A book with this ISBN already exists.' : error.message };
  revalidateLibrary();
  return { success: true, message: 'Book added successfully.' };
}

/** Changing total copies shifts available copies by the same delta (issued copies are preserved). */
export async function updateBook(id: string, updates: Partial<Book>): Promise<ActionResult> {
  const auth = await authorize(...LIBRARIANS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(id)) return { success: false, error: 'Invalid book.' };
  const admin = await createServiceRoleClient();

  const patch: Record<string, unknown> = {};
  for (const k of ['title', 'author', 'category', 'source', 'description', 'publisher', 'published_year', 'digital_url', 'isbn'] as const) {
    if (updates?.[k] !== undefined) patch[k] = updates[k];
  }
  if (updates?.total_copies !== undefined) {
    const { data, error } = await admin.rpc('set_book_total_copies', { p_book_id: id, p_total: Number(updates.total_copies) });
    if (error) return { success: false, error: error.message };
    if (data && data.success === false) return { success: false, error: data.error };
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('books').update(patch).eq('id', id);
    if (error) return { success: false, error: error.message };
  }
  revalidateLibrary();
  return { success: true, message: 'Book updated successfully.' };
}

export async function deleteBook(id: string): Promise<ActionResult> {
  const auth = await authorize(...LIBRARIANS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(id)) return { success: false, error: 'Invalid book.' };
  const admin = await createServiceRoleClient();
  const { count } = await admin.from('book_issues').select('id', { count: 'exact', head: true }).eq('book_id', id).eq('status', 'Issued');
  if ((count || 0) > 0) return { success: false, error: 'This book has copies on loan. Record their return before deleting it.' };
  const { error } = await admin.from('books').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidateLibrary();
  return { success: true, message: 'Book deleted successfully.' };
}

// ── Lending ──────────────────────────────────────────────────────────────────

export interface BookIssue {
  id: string;
  bookId: string;
  bookTitle: string;
  borrowerId: string;
  borrowerName: string;
  borrowerCode: string | null;
  issuedAt: string;
  dueDate: string;
  returnedAt: string | null;
  status: 'Issued' | 'Returned';
  fine: number;
}

function mapIssue(r: any): BookIssue {
  return {
    id: r.id,
    bookId: r.book_id,
    bookTitle: r.books?.title || 'Unknown',
    borrowerId: r.borrower_id,
    borrowerName: r.profiles?.full_name || 'Unknown',
    borrowerCode: r.profiles?.id_code || null,
    issuedAt: r.issued_at,
    dueDate: r.due_date,
    returnedAt: r.returned_at,
    status: r.status,
    fine: Number(r.fine_amount) || 0,
  };
}

/** Issue a copy to a student/teacher identified by college ID / staff code / email. Atomic in SQL. */
export async function issueBook(bookId: string, borrowerIdentifier: string, days = 14): Promise<ActionResult> {
  const auth = await authorize(...LIBRARIANS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(bookId)) return { success: false, error: 'Invalid book.' };
  const ident = String(borrowerIdentifier || '').trim();
  if (!ident) return { success: false, error: 'Enter the borrower’s college ID, staff ID or email.' };

  const safe = ident.replace(/[",()%*\\]/g, '');
  const admin = await createServiceRoleClient();
  const { data: borrower } = await admin
    .from('profiles')
    .select('id, role')
    .or(`id_code.eq."${safe.toUpperCase()}",email.eq."${safe.toLowerCase()}"`)
    .limit(1)
    .maybeSingle();
  if (!borrower) return { success: false, error: 'No user found with that ID or email.' };
  if (!['student', 'teacher'].includes(borrower.role)) return { success: false, error: 'Books can be issued to students and teachers only.' };

  const { data, error } = await admin.rpc('issue_book', {
    p_book_id: bookId,
    p_borrower_id: borrower.id,
    p_days: Math.min(Math.max(1, Number(days) || 14), 90),
    p_issued_by: auth.caller.userId,
  });
  if (error) return { success: false, error: error.message };
  if (data && data.success === false) return { success: false, error: data.error };
  revalidateLibrary();
  return { success: true, message: 'Book issued successfully.' };
}

export async function returnBook(issueId: string): Promise<ActionResult> {
  const auth = await authorize(...LIBRARIANS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(issueId)) return { success: false, error: 'Invalid loan.' };
  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('return_book', { p_issue_id: issueId });
  if (error) return { success: false, error: error.message };
  if (data && data.success === false) return { success: false, error: data.error };
  revalidateLibrary();
  const fine = Number(data?.fine) || 0;
  return { success: true, message: fine > 0 ? `Book returned. Late fine: ₹${fine}.` : 'Book returned.' };
}

export async function getActiveIssues(): Promise<BookIssue[]> {
  await requireRole(...LIBRARIANS);
  const admin = await createServiceRoleClient();
  const rows = await fetchAllRows(() =>
    admin
      .from('book_issues')
      .select('*, books(title), profiles!book_issues_borrower_id_fkey(full_name, id_code)')
      .eq('status', 'Issued')
      .order('due_date'),
  );
  return rows.map(mapIssue);
}

/** The caller's own loans (students/teachers). */
export async function getMyBookIssues(): Promise<BookIssue[]> {
  const caller = await requireRole();
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('book_issues')
    .select('*, books(title), profiles!book_issues_borrower_id_fkey(full_name, id_code)')
    .eq('borrower_id', caller.userId)
    .order('issued_at', { ascending: false })
    .limit(100);
  return (data || []).map(mapIssue);
}

// ── Google Books import ──────────────────────────────────────────────────────

export interface GoogleBookVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

export async function searchGoogleBooks(query: string): Promise<GoogleBookVolume[]> {
  await requireRole(...LIBRARIANS);
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return [];
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function importGoogleBook(googleBookData: GoogleBookVolume): Promise<ActionResult> {
  const auth = await authorize(...LIBRARIANS);
  if (!auth.ok) return { success: false, error: auth.error };
  const v = googleBookData?.volumeInfo;
  if (!v?.title) return { success: false, error: 'Invalid book data.' };

  const isbn = (v.industryIdentifiers?.find((i) => i.type === 'ISBN_13') || v.industryIdentifiers?.find((i) => i.type === 'ISBN_10'))?.identifier || null;
  const year = v.publishedDate ? parseInt(v.publishedDate.substring(0, 4), 10) : NaN;

  const admin = await createServiceRoleClient();
  const { error } = await admin.from('books').insert({
    title: v.title,
    isbn,
    author: v.authors?.join(', ') || 'Unknown Author',
    category: v.categories?.[0] || 'General',
    description: (v.description || '').slice(0, 5000),
    cover_url: v.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
    publisher: v.publisher || null,
    published_year: Number.isNaN(year) ? null : year,
    total_copies: 1,
    available_copies: 1,
    source: 'digital',
    digital_url: `https://books.google.com/books?id=${encodeURIComponent(googleBookData.id)}`,
    added_by: auth.caller.userId,
  });
  if (error) return { success: false, error: error.code === '23505' ? 'This book is already in the catalogue.' : error.message };
  revalidateLibrary();
  return { success: true, message: 'Book imported from Google Books successfully.' };
}
