import { getBookById } from '@/actions/library-actions';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default async function BookDetailsPage({ params }: { params: { id: string } }) {
  const book = await getBookById(params.id);

  if (!book) {
    notFound();
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      <Link href="/library" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Catalog
      </Link>

      <Card className="overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/3 bg-muted p-8 flex items-center justify-center border-b md:border-b-0 md:border-r relative min-h-[300px]">
            {book.cover_url ? (
              <div className="relative w-full max-w-[200px] aspect-[2/3] shadow-md rounded overflow-hidden border">
                <Image 
                  src={book.cover_url} 
                  alt={book.title || 'Book Cover'} 
                  fill 
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
            ) : (
              <BookOpen className="h-24 w-24 text-muted-foreground/30" />
            )}
          </div>
          
          <div className="md:w-2/3 p-6 md:p-8 flex flex-col">
            <div className="mb-6 space-y-2">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline">{book.category || 'General'}</Badge>
                {book.source === 'digital' && <Badge variant="secondary">eBook</Badge>}
                <Badge variant={book.available_copies > 0 ? "default" : "destructive"}>
                  {book.available_copies > 0 ? `${book.available_copies} of ${book.total_copies} Available` : 'Currently Unavailable'}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{book.title}</h1>
              <p className="text-xl text-muted-foreground">{book.author || 'Unknown Author'}</p>
            </div>

            <CardContent className="p-0 flex-1 space-y-6">
              <div>
                <h3 className="font-semibold mb-2 text-foreground">About this book</h3>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                  {book.description || 'No description available for this title.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                <div>
                  <span className="text-muted-foreground block mb-1">Publisher</span>
                  <span className="font-medium">{book.publisher || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Published Year</span>
                  <span className="font-medium">{book.published_year || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">ISBN</span>
                  <span className="font-medium">{book.isbn || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Format</span>
                  <span className="font-medium capitalize">{book.source}</span>
                </div>
              </div>
            </CardContent>

            {book.digital_url && (
              <div className="mt-8 pt-6 border-t">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href={book.digital_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Read Online / Preview
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
