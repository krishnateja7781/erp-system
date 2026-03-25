'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import type { Book, ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function getBooks(): Promise<Book[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });
  
  if (error) {
    console.error("Error fetching books:", error);
    return [];
  }
  return data || [];
}

export async function getBookById(id: string): Promise<Book | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('books').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

export async function addBook(bookData: Partial<Book>): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  
  const { error } = await supabase.from('books').insert({
    title: bookData.title,
    isbn: bookData.isbn,
    author: bookData.author,
    category: bookData.category,
    publisher: bookData.publisher,
    published_year: bookData.published_year,
    total_copies: bookData.total_copies || 1,
    available_copies: bookData.total_copies || 1,
    source: bookData.source || 'physical'
  });

  if (error) {
    return { success: false, error: error.message };
  }
  
  revalidatePath('/employee/library');
  revalidatePath('/library');
  return { success: true, message: 'Book added successfully.' };
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  
  const { error } = await supabase.from('books').update({
    title: updates.title,
    author: updates.author,
    category: updates.category,
    total_copies: updates.total_copies,
    available_copies: updates.available_copies,
    source: updates.source
  }).eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }
  
  revalidatePath('/employee/library');
  revalidatePath('/library');
  return { success: true, message: 'Book updated successfully.' };
}

export async function deleteBook(id: string): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('books').delete().eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }
  
  revalidatePath('/employee/library');
  revalidatePath('/library');
  return { success: true, message: 'Book deleted successfully.' };
}

// ==========================================
// GOOGLE BOOKS API INTEGRATION
// ==========================================

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
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
}

/**
 * Searches the public Google Books API for books matching a query.
 */
export async function searchGoogleBooks(query: string): Promise<GoogleBookVolume[]> {
  if (!query || query.trim().length === 0) return [];
  
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12`);
    if (!res.ok) {
      console.error('Failed to fetch from Google Books API', await res.text());
      return [];
    }
    const data = await res.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching Google Books:', error);
    return [];
  }
}

/**
 * Imports a book from Google Books into our local Supabase database.
 */
export async function importGoogleBook(googleBookData: GoogleBookVolume): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  
  const v = googleBookData.volumeInfo;
  
  // Extract ISBN if available
  let isbn = '';
  if (v.industryIdentifiers) {
    const isbn13 = v.industryIdentifiers.find(i => i.type === 'ISBN_13');
    const isbn10 = v.industryIdentifiers.find(i => i.type === 'ISBN_10');
    isbn = (isbn13 || isbn10)?.identifier || '';
  }

  // Parse Year
  let published_year = null;
  if (v.publishedDate) {
    published_year = parseInt(v.publishedDate.substring(0, 4), 10);
  }

  const { error } = await supabase.from('books').insert({
    title: v.title,
    isbn: isbn || null,
    author: v.authors ? v.authors.join(', ') : 'Unknown Author',
    category: v.categories ? v.categories[0] : 'General',
    description: v.description || '',
    cover_url: v.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
    publisher: v.publisher || 'Unknown Publisher',
    published_year: Number.isNaN(published_year) ? null : published_year,
    total_copies: 1,
    available_copies: 1,
    source: 'digital',
    digital_url: `https://books.google.com/books?id=${googleBookData.id}`
  });

  if (error) {
    return { success: false, error: error.message };
  }
  
  revalidatePath('/employee/library');
  revalidatePath('/library');
  return { success: true, message: 'Book imported from Google Books successfully.' };
}
