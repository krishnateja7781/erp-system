'use client';

import * as React from 'react';
import { searchGoogleBooks, importGoogleBook, type GoogleBookVolume } from '@/actions/library-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Search, Download, Loader2 } from 'lucide-react';
import Image from 'next/image';

export function GoogleBooksSearch() {
  const [query, setQuery] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [results, setResults] = React.useState<GoogleBookVolume[]>([]);
  const [importingId, setImportingId] = React.useState<string | null>(null);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    setResults([]);
    
    try {
      const books = await searchGoogleBooks(query);
      setResults(books);
      if (books.length === 0) {
        toast({ title: 'No results found', description: 'Try adjusting your search terms.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Search failed', description: 'Could not contact Google Books API.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleImport = async (book: GoogleBookVolume) => {
    setImportingId(book.id);
    try {
      const res = await importGoogleBook(book);
      if (!res.success) throw new Error(res.error);
      
      toast({ title: 'Success', description: 'Book imported to internal library catalog!' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Import Failed', description: err.message });
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search global repository by title, author, or ISBN..."
            className="pl-9 h-11"
          />
        </div>
        <Button type="submit" disabled={isSearching || !query.trim()} className="h-11 px-8">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
          Search API
        </Button>
      </form>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((book) => {
            const v = book.volumeInfo;
            const coverUrl = v.imageLinks?.thumbnail?.replace('http:', 'https:');
            
            return (
              <Card key={book.id} className="flex flex-col h-full hover:border-primary/50 transition-colors hidden-overflow">
                <div className="flex p-4 gap-4 bg-muted/30">
                  <div className="shrink-0 w-[80px] h-[120px] bg-muted relative rounded-md overflow-hidden bg-white shadow-sm border">
                    {coverUrl ? (
                      <Image src={coverUrl} alt="Cover" fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/50 text-xs text-center p-2 text-muted-foreground">
                        No Cover
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    <h3 className="font-semibold text-base line-clamp-2 leading-tight">{v.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{v.authors?.join(', ') || 'Unknown Author'}</p>
                    {v.publishedDate && (
                      <p className="text-xs text-muted-foreground mt-1">Pub. {v.publishedDate.substring(0, 4)}</p>
                    )}
                  </div>
                </div>
                <CardContent className="p-4 pt-2 flex-1">
                  <p className="text-sm text-foreground/80 line-clamp-3">
                    {v.description || 'No description available for this volume.'}
                  </p>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button 
                    variant="default" 
                    className="w-full shadow-sm"
                    onClick={() => handleImport(book)}
                    disabled={importingId !== null}
                  >
                    {importingId === book.id ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" /> Import to Catalog</>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
