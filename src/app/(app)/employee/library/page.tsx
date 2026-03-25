'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Library, Search, Plus, Loader2, BookOpen, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBooks, addBook, deleteBook } from '@/actions/library-actions';
import { useToast } from '@/hooks/use-toast';
import type { Book } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function EmployeeLibraryPage() {
  const [books, setBooks] = React.useState<Book[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = React.useState({
    title: '', author: '', isbn: '', category: '', publisher: '', published_year: '', total_copies: '1', source: 'physical'
  });

  const loadBooks = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getBooks();
      setBooks(data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load library catalog.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { loadBooks(); }, [loadBooks]);

  const filteredBooks = React.useMemo(() => {
    return books.filter(b => {
      const lower = search.toLowerCase();
      return !search || (b.title?.toLowerCase().includes(lower)) || (b.author?.toLowerCase().includes(lower)) || (b.isbn?.toLowerCase().includes(lower));
    });
  }, [books, search]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await addBook({
        title: formData.title,
        author: formData.author,
        isbn: formData.isbn,
        category: formData.category,
        publisher: formData.publisher,
        published_year: parseInt(formData.published_year) || new Date().getFullYear(),
        total_copies: parseInt(formData.total_copies) || 1,
        source: formData.source as any
      });
      if (res.success) {
        toast({ title: 'Success', description: res.message });
        setIsAddOpen(false);
        setFormData({ title: '', author: '', isbn: '', category: '', publisher: '', published_year: '', total_copies: '1', source: 'physical' });
        loadBooks();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
        setIsLoading(true);
        const res = await deleteBook(id);
        if (res.success) {
            toast({ title: 'Deleted', description: res.message });
            loadBooks();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
            setIsLoading(false);
        }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-500 p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Library Catalog Management</h1>
            <p className="text-white/80 text-sm mt-2">Manage books, inventory levels, and digital sources securely.</p>
          </div>
          <Library className="h-16 w-16 opacity-20" />
        </div>
      </div>

      <Card className="card-elevated border-l-4 border-l-cyan-500">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl text-cyan-700 dark:text-cyan-500">Inventory Catalog</CardTitle>
              <CardDescription>Search and filter registered institution texts</CardDescription>
            </div>
            <Button onClick={() => setIsAddOpen(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white shadow-md">
              <Plus className="mr-2 h-4 w-4" /> Add New Book
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cyan-500" />
              <Input
                placeholder="Search catalog by title, author, or ISBN..."
                className="pl-9 focus-visible:ring-cyan-500 border-cyan-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md border border-cyan-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-cyan-50 dark:bg-cyan-950/20">
                <TableRow>
                  <TableHead className="font-semibold text-cyan-900 dark:text-cyan-400">Title</TableHead>
                  <TableHead className="font-semibold text-cyan-900 dark:text-cyan-400">Author</TableHead>
                  <TableHead className="font-semibold text-cyan-900 dark:text-cyan-400">Category</TableHead>
                  <TableHead className="font-semibold text-cyan-900 dark:text-cyan-400">Available</TableHead>
                  <TableHead className="font-semibold text-cyan-900 dark:text-cyan-400">Status</TableHead>
                  <TableHead className="text-right font-semibold text-cyan-900 dark:text-cyan-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mb-2" />
                        <span className="text-sm text-muted-foreground">Loading catalog...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredBooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No books found in the catalog.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBooks.map((book) => (
                    <TableRow key={book.id} className="hover:bg-cyan-50/50 dark:hover:bg-cyan-900/10">
                      <TableCell>
                        <div className="font-medium text-cyan-800 dark:text-cyan-300 flex items-center gap-2">
                           <BookOpen className="h-4 w-4 text-muted-foreground" />
                           {book.title}
                        </div>
                        <div className="text-xs text-muted-foreground">{book.isbn ? `ISBN: ${book.isbn}` : 'No ISBN'}</div>
                      </TableCell>
                      <TableCell>{book.author || 'Unknown'}</TableCell>
                      <TableCell><Badge variant="outline">{book.category || 'General'}</Badge></TableCell>
                      <TableCell>
                         <div className="font-medium">{book.available_copies} / {book.total_copies}</div>
                      </TableCell>
                      <TableCell>
                          {book.available_copies > 0 
                             ? <Badge className="bg-green-600 hover:bg-green-700">Available</Badge> 
                             : <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-200 border-0">Checked Out</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => handleDelete(book.id, book.title)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Volume
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[550px]">
             <DialogHeader>
                 <DialogTitle>Add New Book</DialogTitle>
                 <DialogDescription>Register a new volume into the institutional library.</DialogDescription>
             </DialogHeader>
             <form onSubmit={handleAddSubmit} className="space-y-4 py-4" id="add-book-form">
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2 col-span-2">
                         <Label>Book Title *</Label>
                         <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Principia Mathematica" />
                     </div>
                     <div className="space-y-2">
                         <Label>Author</Label>
                         <Input required value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} placeholder="e.g. Isaac Newton" />
                     </div>
                     <div className="space-y-2">
                         <Label>ISBN</Label>
                         <Input value={formData.isbn} onChange={e => setFormData({...formData, isbn: e.target.value})} placeholder="e.g. 978-3-16-148410-0" />
                     </div>
                     <div className="space-y-2">
                         <Label>Category</Label>
                         <Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="e.g. Mathematics" />
                     </div>
                     <div className="space-y-2">
                         <Label>Source</Label>
                         <Select value={formData.source} onValueChange={v => setFormData({...formData, source: v})}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="physical">Physical Hardcopy</SelectItem>
                                <SelectItem value="digital">Digital PDF</SelectItem>
                                <SelectItem value="both">Hybrid (Both)</SelectItem>
                            </SelectContent>
                         </Select>
                     </div>
                     <div className="space-y-2">
                         <Label>Total Copies *</Label>
                         <Input required type="number" min="1" value={formData.total_copies} onChange={e => setFormData({...formData, total_copies: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                         <Label>Published Year</Label>
                         <Input type="number" value={formData.published_year} onChange={e => setFormData({...formData, published_year: e.target.value})} placeholder="YYYY" />
                     </div>
                 </div>
             </form>
             <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                <Button type="submit" form="add-book-form" disabled={isSubmitting} className="bg-cyan-600 hover:bg-cyan-700">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save Data'}
                </Button>
             </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
