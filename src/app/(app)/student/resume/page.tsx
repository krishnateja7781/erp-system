
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Download, Image as ImageIcon, Sparkles, ArrowLeft, CheckCircle, FileText, Palette, Feather } from "lucide-react";
import { ResumeDisplay } from '@/components/student/resume-display';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { resumeSchema, type ResumeFormValues } from '@/lib/resume-schema';
import { getMyResume, saveMyResume } from '@/actions/resume-actions';
import { Save, Loader2 } from 'lucide-react';

// Empty starting point; real values are loaded from the student's record / saved resume.
const defaultResumeValues: ResumeFormValues = {
  name: '', role: '', photoUrl: '', phone: '', email: '', address: '', linkedIn: '', github: '', objective: '',
  education: [], skills: [], projects: [], achievements: [],
};

type BuilderStep = 'select-style' | 'select-template' | 'build';
type ResumeStyle = 'modern' | 'classic' | 'compact';

// --- Template Preview Components ---
const TemplatePreview = ({ name, description, children, onSelect }: { name: string, description: string, children: React.ReactNode, onSelect: () => void }) => (
  <Card onClick={onSelect} className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group flex flex-col card-elevated">
    <CardHeader>
      <CardTitle>{name}</CardTitle>

    </CardHeader>
    <CardContent className="h-64 flex-grow border-t pt-4">
      {children}
    </CardContent>
  </Card>
);

const ModernSidebarPreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex gap-1"><div className="w-1/3 h-full bg-primary/20 rounded-sm"></div><div className="w-2/3 h-full flex flex-col gap-1"><div className="h-4 bg-muted rounded-sm w-full"></div><div className="h-2 bg-muted/50 rounded-sm w-3/4"></div><div className="h-8 mt-2 bg-muted rounded-sm w-full"></div><div className="h-8 bg-muted rounded-sm w-full"></div></div></div>);
const ModernHeaderPreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex flex-col gap-1"><div className="h-10 bg-primary/20 rounded-sm w-full"></div><div className="h-8 mt-2 bg-muted rounded-sm w-full"></div><div className="h-8 bg-muted rounded-sm w-full"></div><div className="h-2 bg-muted/50 rounded-sm w-3/4 mt-auto"></div></div>);
const ModernMinimalistPreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex flex-col gap-2"><div className="h-4 bg-muted rounded-sm w-1/2 mx-auto"></div><div className="h-2 bg-muted/50 rounded-sm w-1/3 mx-auto"></div><div className="border-b w-full my-1"></div><div className="h-8 bg-muted/50 rounded-sm w-full"></div><div className="h-2 bg-muted rounded-sm w-3/4"></div></div>);
const ModernIconicPreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex flex-col gap-2"><div className="h-10 bg-muted/30 rounded-sm w-full flex items-center justify-between px-2"><div className="w-8 h-8 rounded-full bg-primary/20"></div><div className="flex-1 pl-2 space-y-1"><div className="h-2 rounded bg-muted"></div><div className="h-2 rounded w-1/2 bg-muted"></div></div></div><div className="h-8 mt-2 bg-muted rounded-sm w-full"></div><div className="h-2 bg-muted/50 rounded-sm w-3/4 mt-auto"></div></div>);

const ClassicProfessionalPreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex flex-col gap-1"><div className="h-4 bg-muted rounded-sm w-full"></div><div className="h-2 bg-muted/50 rounded-sm w-3/4 self-center"></div><div className="h-2 mt-1 border-b border-primary/50 w-full"></div><div className="h-8 mt-1 bg-muted rounded-sm w-full"></div><div className="h-8 bg-muted rounded-sm w-full"></div></div>);
const ClassicAcademicPreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex flex-col gap-2"><div className="h-4 bg-muted rounded-sm w-1/2"></div><div className="h-2 bg-muted/50 rounded-sm w-full"></div><div className="h-8 mt-2 bg-muted/80 rounded-sm w-full"></div><div className="h-8 bg-muted/80 rounded-sm w-full"></div></div>);
const ClassicTimelessPreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex flex-col gap-2"><div className="h-4 bg-muted rounded-sm w-1/2 mx-auto"></div><div className="border-t border-b border-muted/80 my-2 py-1"><div className="h-2 bg-muted/50 w-full"></div></div><div className="h-8 bg-muted/50 rounded-sm w-full"></div><div className="h-2 bg-muted rounded-sm w-3/4"></div></div>);
const ClassicExecutivePreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex flex-col gap-1"><div className="h-5 bg-primary/80 rounded-sm w-full"></div><div className="h-8 mt-2 bg-muted rounded-sm w-full"></div><div className="h-8 bg-muted rounded-sm w-full"></div><div className="h-2 bg-muted/50 rounded-sm w-3/4 mt-auto"></div></div>);

const CompactTwoColPreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex gap-1"><div className="w-1/2 h-full flex flex-col gap-1"><div className="h-4 bg-muted rounded-sm w-full"></div><div className="h-2 bg-muted/50 rounded-sm w-3/4"></div><div className="h-8 mt-2 bg-muted rounded-sm w-full"></div><div className="h-8 bg-muted rounded-sm w-full"></div></div><div className="w-1/2 h-full flex flex-col gap-1"><div className="h-4 bg-muted rounded-sm w-full"></div><div className="h-8 mt-2 bg-muted rounded-sm w-full"></div><div className="h-8 bg-muted rounded-sm w-full"></div></div></div>);
const CompactInfoDensePreview = () => (<div className="w-full h-full bg-white border rounded-md p-1 flex flex-col gap-1"><div className="h-3 bg-muted rounded-sm w-full"></div><div className="h-2 bg-muted/50 rounded-sm w-full"></div><div className="h-6 mt-1 bg-muted rounded-sm w-full"></div><div className="h-6 bg-muted rounded-sm w-full"></div><div className="h-6 bg-muted rounded-sm w-full"></div><div className="h-2 bg-muted/50 rounded-sm w-3/4 mt-auto"></div></div>);
const CompactReversePreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex gap-1"><div className="w-2/3 h-full flex flex-col gap-1"><div className="h-4 bg-muted rounded-sm w-full"></div><div className="h-8 mt-2 bg-muted rounded-sm w-full"></div><div className="h-8 bg-muted rounded-sm w-full"></div></div><div className="w-1/3 h-full bg-primary/20 rounded-sm"></div></div>);
const CompactHeaderSplitPreview = () => (<div className="w-full h-full bg-white border rounded-md p-2 flex flex-col gap-2"><div className="flex gap-2"><div className="w-1/2 h-10 bg-muted/30 rounded-sm"></div><div className="w-1/2 h-10 bg-muted/30 rounded-sm"></div></div><div className="h-8 bg-muted rounded-sm w-full"></div><div className="h-8 bg-muted rounded-sm w-full"></div></div>);


const templates: Record<ResumeStyle, { id: string; name: string; description: string; preview: React.ReactNode; }[]> = {
  modern: [
    { id: 'modern-sidebar', name: 'Sidebar Left', description: 'Classic two-column with a colored sidebar.', preview: <ModernSidebarPreview /> },
    { id: 'modern-header', name: 'Color Header', description: 'A bold header sets a vibrant tone.', preview: <ModernHeaderPreview /> },
    { id: 'modern-iconic', name: 'Iconic', description: 'Uses icons for a quick visual guide.', preview: <ModernIconicPreview /> },
    { id: 'modern-minimalist', name: 'Minimalist', description: 'Clean lines and ample whitespace.', preview: <ModernMinimalistPreview /> },
  ],
  classic: [
    { id: 'classic-professional', name: 'Professional', description: 'The timeless, standard resume format.', preview: <ClassicProfessionalPreview /> },
    { id: 'classic-academic', name: 'Academic', description: 'Structured for research and publications.', preview: <ClassicAcademicPreview /> },
    { id: 'classic-executive', name: 'Executive', description: 'A strong header for leadership roles.', preview: <ClassicExecutivePreview /> },
    { id: 'classic-timeless', name: 'Timeless', description: 'Simple, elegant, and highly readable.', preview: <ClassicTimelessPreview /> },
  ],
  compact: [
    { id: 'compact-two-column', name: 'Two Column', description: 'Splits content for maximum information.', preview: <CompactTwoColPreview /> },
    { id: 'compact-info-dense', name: 'Info-Dense', description: 'Smaller fonts and tighter spacing.', preview: <CompactInfoDensePreview /> },
    { id: 'compact-reverse-sidebar', name: 'Reverse Sidebar', description: 'Main content on the left, details on the right.', preview: <CompactReversePreview /> },
    { id: 'compact-header-split', name: 'Split Header', description: 'Divides header information for clarity.', preview: <CompactHeaderSplitPreview /> },
  ]
};

export default function ResumeBuilderPage() {
  const resumeRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [step, setStep] = React.useState<BuilderStep>('select-style');
  const [selectedStyle, setSelectedStyle] = React.useState<ResumeStyle | null>(null);
  const [selectedTemplate, setSelectedTemplate] = React.useState<string | null>(null);
  const [showPhoto, setShowPhoto] = React.useState(true);

  const form = useForm<ResumeFormValues>({
    resolver: zodResolver(resumeSchema),
    defaultValues: defaultResumeValues,
    mode: 'onChange',
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  // Load the saved resume (or a draft prefilled from the student's record).
  React.useEffect(() => {
    getMyResume()
      .then((r) => {
        form.reset(r.values);
        setShowPhoto(r.showPhoto);
        setSavedAt(r.savedAt);
        if (r.templateId) {
          const style = (Object.keys(templates) as ResumeStyle[]).find((k) => templates[k].some((t) => t.id === r.templateId));
          if (style) {
            setSelectedStyle(style);
            setSelectedTemplate(r.templateId);
            setStep('build');
          }
        }
      })
      .catch(() => toast({ variant: 'destructive', title: 'Error', description: 'Could not load your resume.' }));
  }, [form, toast]);

  const handleSave = async () => {
    const valid = await form.trigger();
    if (!valid) {
      toast({ variant: 'destructive', title: 'Check your resume', description: 'Some required fields are missing or invalid.' });
      return;
    }
    setIsSaving(true);
    const res = await saveMyResume(form.getValues(), selectedTemplate || 'modern-sidebar', showPhoto);
    setIsSaving(false);
    if (res.success) {
      setSavedAt(new Date().toISOString());
      toast({ title: 'Saved', description: 'Your resume has been saved.' });
    } else {
      toast({ variant: 'destructive', title: 'Save failed', description: res.error });
    }
  };

  const handleSelectStyle = (style: ResumeStyle) => {
    setSelectedStyle(style);
    setStep('select-template');
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    setStep('build');
  };

  const handleDownloadPdf = async () => {
    if (!resumeRef.current) {
      toast({ variant: "destructive", title: "Error", description: "Resume content is not available for download." });
      return;
    }
    toast({ title: "Info", description: "Generating PDF..." });
    try {
      const canvas = await html2canvas(resumeRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = imgProps.width;
      const imgHeight = imgProps.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`resume_${form.getValues('name')?.replace(/\s/g, '_') || 'resume'}.pdf`);
      toast({ title: "Success", description: "Resume downloaded as PDF." });
    } catch (e) {
      console.error("PDF Generation Error:", e);
      toast({ variant: "destructive", title: "Download Failed", description: "Could not generate PDF." });
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'select-style':
        return (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 mb-6 text-white shadow-lg text-center">
              <div className="relative z-10">
                <h1 className="text-3xl font-bold">Choose a Resume Style</h1>
                <p className="text-white/70 text-sm mt-1">Select a style that best represents your professional profile</p>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <TemplatePreview name="Modern" description="Stylish layouts, often with columns and color accents. Great for creative and tech fields." onSelect={() => handleSelectStyle('modern')}><ModernSidebarPreview /></TemplatePreview>
              <TemplatePreview name="Classic" description="Traditional, single-column designs. Professional and universally accepted." onSelect={() => handleSelectStyle('classic')}><ClassicProfessionalPreview /></TemplatePreview>
              <TemplatePreview name="Compact" description="Dense, multi-column layouts to fit a lot of information on a single page." onSelect={() => handleSelectStyle('compact')}><CompactTwoColPreview /></TemplatePreview>
            </div>
          </div>
        );
      case 'select-template':
        if (!selectedStyle) return null;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setStep('select-style')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Styles
              </Button>
              <h1 className="text-2xl font-bold capitalize">Select a {selectedStyle} Template</h1>
            </div>
            <p className="text-muted-foreground">Choose a specific template to start building your resume.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
              {templates[selectedStyle].map(template => (
                <TemplatePreview key={template.id} name={template.name} description={template.description} onSelect={() => handleSelectTemplate(template.id)}>
                  {template.preview}
                </TemplatePreview>
              ))}
            </div>
          </div>
        );
      case 'build':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep('select-template')} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Change Template
                    </Button>
                    <div className="flex items-center text-sm">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      <span className="font-medium text-muted-foreground">Selected: <span className="capitalize text-foreground">{selectedTemplate?.replace(/-/g, ' ')}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch id="show-photo" checked={showPhoto} onCheckedChange={setShowPhoto} />
                      <Label htmlFor="show-photo" className="flex items-center gap-1"><ImageIcon className="h-4 w-4" /> Photo</Label>
                    </div>
                    <Button type="button" variant="outline" onClick={handleSave} disabled={isSaving} className="gap-2" title={savedAt ? `Last saved ${new Date(savedAt).toLocaleString()}` : 'Not saved yet'}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                    </Button>
                    <Button onClick={handleDownloadPdf} className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md">
                      <Download className="h-4 w-4" /> Download PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Form {...form}>
              <form>
                <div className="bg-muted p-4 sm:p-8 rounded-lg overflow-y-auto shadow-inner">
                  <ResumeDisplay
                    ref={resumeRef}
                    control={form.control}
                    showPhoto={showPhoto}
                    templateId={selectedTemplate!}
                  />
                </div>
              </form>
            </Form>
          </div>
        );
      default:
        return <div>Invalid step</div>;
    }
  };

  return <div className="space-y-4 animate-fade-in">{renderContent()}</div>;
}
