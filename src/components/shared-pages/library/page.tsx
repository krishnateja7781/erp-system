import { getBooks } from '@/actions/library-actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default async function LibraryPage() {
  const books = await getBooks();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Library Catalog</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Browse and search our school's collection of physical and digital books.
          </p>
        </div>
      </div>

      {books.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="text-xl">No books found</CardTitle>
          <CardDescription className="max-w-sm mt-2">
            The catalog is currently empty. Librarians can import new collections from Google Books using the management tools.
          </CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {books.map((book) => (
            <Card key={book.id} className="overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
              <div className="aspect-[2/3] w-full bg-muted relative flex items-center justify-center border-b">
                {book.cover_url ? (
                  <Image 
                    src={book.cover_url} 
                    alt={book.title || 'Book Cover'} 
                    fill 
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <BookOpen className="h-16 w-16 text-muted-foreground/30" />
                )}
                {book.source === 'digital' && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="backdrop-blur-md bg-background/80">eBook</Badge>
                  </div>
                )}
              </div>
              <CardHeader className="p-4 pb-2 space-y-1 flex-1">
                <CardTitle className="line-clamp-2 leading-snug">{book.title}</CardTitle>
                <CardDescription className="line-clamp-1">{book.author}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">{book.category || 'General'}</Badge>
                  <Badge 
                    variant={book.available_copies > 0 ? "default" : "destructive"} 
                    className="text-[10px]"
                  >
                    {book.available_copies > 0 ? 'Available' : 'Checked Out'}
                  </Badge>
                </div>
              </CardContent>
              {book.digital_url && (
                <CardFooter className="p-4 bg-muted/20 border-t mt-auto">
                  <Link 
                    href={book.digital_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full text-center text-sm font-medium text-primary hover:underline"
                  >
                    Read Online preview &rarr;
                  </Link>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
