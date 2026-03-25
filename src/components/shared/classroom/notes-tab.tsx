'use client';

import * as React from 'react';
import { supabase } from '@/lib/supabase-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileUp, FileText, Trash2, Download, Eye, File, FileSpreadsheet, Presentation, Image as ImageIcon, StickyNote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validateNoteFile, uploadNoteFile } from '@/lib/upload-note';
import {
  createNoteRecord,
  listNotes,
  deleteNote,
  type ClassroomNote,
} from '@/actions/classroom-note-actions';

interface NotesTabProps {
  classroomId: string;
  userId: string;
  userName: string;
  userRole: 'teacher' | 'student' | 'admin';
}

function getFileIcon(fileType: string) {
  if (fileType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
  if (fileType.includes('word') || fileType.includes('document')) return <File className="h-5 w-5 text-blue-500" />;
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return <Presentation className="h-5 w-5 text-orange-500" />;
  if (fileType.includes('image')) return <ImageIcon className="h-5 w-5 text-purple-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtLabel(fileType: string): string {
  if (fileType.includes('pdf')) return 'PDF';
  if (fileType.includes('wordprocessingml') || fileType.includes('msword')) return 'DOCX';
  if (fileType.includes('spreadsheetml') || fileType.includes('ms-excel')) return 'XLSX';
  if (fileType.includes('presentationml') || fileType.includes('ms-powerpoint')) return 'PPTX';
  if (fileType.includes('text/plain')) return 'TXT';
  if (fileType.includes('image/png')) return 'PNG';
  if (fileType.includes('image/jpeg')) return 'JPG';
  return 'FILE';
}

export function NotesTab({ classroomId, userId, userName, userRole }: NotesTabProps) {
  const { toast } = useToast();
  const [notes, setNotes] = React.useState<ClassroomNote[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadNotes = React.useCallback(async () => {
    try {
      const data = await listNotes(classroomId);
      setNotes(data);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load notes.' });
    }
  }, [classroomId, toast]);

  // Initial load
  React.useEffect(() => {
    setIsLoading(true);
    loadNotes().finally(() => setIsLoading(false));
  }, [loadNotes]);

  // Polling — uses direct Supabase client reads (not server actions)
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('classroom_notes')
          .select('*')
          .eq('classroomId', classroomId)
          .order('createdAt', { ascending: false });
        if (!data) return;
        setNotes((prev) => {
          const prevIds = prev.map((n) => n.id).join(',');
          const newIds = data.map((n: any) => n.id).join(',');
          if (prevIds === newIds) return prev;
          return data as ClassroomNote[];
        });
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [classroomId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a file to upload.' });
      return;
    }

    // Validate file type and size on client side
    const validationError = validateNoteFile(selectedFile);
    if (validationError) {
      toast({ variant: 'destructive', title: 'Invalid File', description: validationError });
      return;
    }

    setIsUploading(true);
    try {
      // Step 1: Upload file directly from browser to Supabase Storage
      const uploaded = await uploadNoteFile(selectedFile, classroomId);

      // Step 2: Save note record in DB via server action
      const result = await createNoteRecord({
        classroomId,
        teacherId: userId,
        teacherName: userName,
        description,
        fileName: uploaded.fileName,
        fileUrl: uploaded.fileUrl,
        fileType: uploaded.fileType,
        fileSize: uploaded.fileSize,
      });

      if (result.success) {
        toast({ title: 'Uploaded', description: 'Note has been shared with the class.' });
        setDescription('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadNotes();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to upload note.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      const result = await deleteNote(noteId, userId);
      if (result.success) {
        toast({ title: 'Deleted', description: 'Note has been removed.' });
        setNotes(prev => prev.filter(n => n.id !== noteId));
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete note.' });
    }
  };

  const isTeacher = userRole === 'teacher';

  return (
    <div className="space-y-6">
      {/* Teacher Upload Section */}
      {isTeacher && (
        <Card className="border-dashed border-2 border-violet-500/20 bg-violet-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileUp className="h-5 w-5 text-violet-500" />
              Share Notes
            </CardTitle>
            <CardDescription>Upload documents to share with your students</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Description input */}
            <Textarea
              placeholder="Add a description about these notes... (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none min-h-[80px]"
            />

            {/* File picker */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex-1 w-full">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-500/10 file:text-violet-600 dark:file:text-violet-400 hover:file:bg-violet-500/20"
                />
              </div>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white gap-2 shrink-0"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>

            {/* Selected file preview */}
            {selectedFile && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/60">
                {getFileIcon(selectedFile.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{getFileExtLabel(selectedFile.type)}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <StickyNote className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold text-muted-foreground">No notes yet</p>
          <p className="text-sm text-muted-foreground/70">
            {isTeacher ? 'Upload documents above to share notes with your students.' : 'Your teacher hasn\'t shared any notes yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <Card key={note.id} className="transition-all hover:shadow-md">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  {/* File icon */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/80 shrink-0">
                    {getFileIcon(note.fileType)}
                  </div>

                  {/* Note details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Teacher name + date */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{note.teacherName}</span>
                      <span>·</span>
                      <span>{new Date(note.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>{new Date(note.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Description */}
                    {note.description && (
                      <p className="text-sm text-foreground leading-relaxed">{note.description}</p>
                    )}

                    {/* File info */}
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        {getFileIcon(note.fileType)}
                        {note.fileName}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{formatFileSize(note.fileSize)}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-8"
                        onClick={() => window.open(note.fileUrl, '_blank')}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View Document
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-8"
                        asChild
                      >
                        <a href={note.fileUrl} download={note.fileName} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* Delete button (teacher only) */}
                  {isTeacher && note.teacherId === userId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
