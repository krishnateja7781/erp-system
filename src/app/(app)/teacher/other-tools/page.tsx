import { GoogleFormsIntegration } from "@/components/teacher/google-forms-integration";
import { Sparkles, Layers, ListChecks } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OtherToolsPage() {
  return (
    <div className="flex-1 space-y-4 animate-fade-in">
      <div className="dashboard-hero mb-6">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-white">Other Tools & Integrations</h1>
          <p className="text-white/70 mt-2 text-sm leading-relaxed max-w-lg">Manage your third-party connections to enhance your teaching experience.</p>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 px-8 pb-8">
        <div className="col-span-2">
          <GoogleFormsIntegration />
        </div>
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Sparkles className="w-5 h-5 mr-2 text-purple-500" />
                Available Extensions
              </CardTitle>
              <CardDescription>Extra utilities for your classroom</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4 p-3 rounded-lg border bg-card/50">
                <div className="bg-primary/10 p-2 rounded-md">
                  <ListChecks className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Google Forms</h4>
                  <p className="text-xs text-muted-foreground mt-1">Connect your workspace to create quizzes and sync grades automatically.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-3 rounded-lg border bg-card/50 opacity-50">
                <div className="bg-primary/10 p-2 rounded-md">
                  <Layers className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Plagiarism Checker</h4>
                  <p className="text-xs text-muted-foreground mt-1">Coming soon. Scan assignment submissions for originality.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
