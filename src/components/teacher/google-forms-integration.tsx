"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, FileVideo2, Loader2, Plus, ExternalLink, ServerCrash, RefreshCw, Unlink, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { checkGoogleLinked, getGoogleAuthUrl, request, issueBackendToken } from "@/lib/google-classroom-api";

export function GoogleFormsIntegration() {
  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [forms, setForms] = useState<any[]>([]);
  const [formsLoaded, setFormsLoaded] = useState(false);
  const [backendOffline, setBackendOffline] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  // Create form dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState("");

  useEffect(() => {
    issueBackendToken().then(() => checkConnectionStatus());

    const handleMessage = (event: MessageEvent) => {
      if (event.data === "google-auth-success") {
        setNeedsReconnect(false);
        issueBackendToken().then(() => checkConnectionStatus());
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const checkConnectionStatus = async () => {
    setIsLoading(true);
    try {
      const data = await checkGoogleLinked();
      setBackendOffline(false);
      setIsLinked(data.linked);
    } catch (err: any) {
      if (err?.message?.includes('fetch') || err?.name === 'TypeError') {
        setBackendOffline(true);
        setIsLinked(null);
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    const width = 500;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      getGoogleAuthUrl(),
      "GoogleAuth",
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  // Internal: clears token without showing disconnect toast (used for auto-reconnect)
  const silentDisconnect = async () => {
    try {
      await request('/api/google/forms/disconnect', { method: 'DELETE' });
    } catch (_) { /* ignore */ }
    setIsLinked(false);
    setForms([]);
    setFormsLoaded(false);
    setNeedsReconnect(false);
  };

  const handleDisconnect = async () => {
    await silentDisconnect();
    toast({ title: "Disconnected", description: "Your Google account has been unlinked." });
  };

  const loadForms = async () => {
    setIsSyncing(true);
    try {
      const data = await request<{ forms: any[]; needsReconnect?: boolean }>('/api/google/forms');
      if ((data as any).needsReconnect) {
        // Auto-fix: clear old token and immediately reopen OAuth with new scopes
        toast({ title: "🔄 Re-authorizing...", description: "Your account needs updated Forms permissions. Opening Google sign-in..." });
        await silentDisconnect();
        setTimeout(handleConnect, 800);
        return;
      }
      setForms(data.forms || []);
      setFormsLoaded(true);
      toast({ title: "✅ Synced", description: `Found ${data.forms?.length || 0} form(s) in your Drive.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateForm = async () => {
    if (!newFormTitle.trim()) {
      toast({ variant: "destructive", title: "Title required", description: "Please enter a title for your form." });
      return;
    }
    setIsCreating(true);
    try {
      const data = await request<{ form: any; needsReconnect?: boolean }>('/api/google/forms/create', {
        method: 'POST',
        body: JSON.stringify({ title: newFormTitle.trim() })
      });

      if ((data as any).needsReconnect) {
        // Auto-fix: clear old token and immediately reopen OAuth with new scopes
        setCreateDialogOpen(false);
        toast({ title: "🔄 Re-authorizing...", description: "Opening Google sign-in with updated permissions..." });
        await silentDisconnect();
        setTimeout(handleConnect, 800);
        return;
      }

      const formTitle = data.form?.info?.title || newFormTitle;
      toast({ title: "✅ Form Created!", description: `"${formTitle}" has been created in your Google Drive.` });
      setCreateDialogOpen(false);
      setNewFormTitle("");
      loadForms();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error Creating Form", description: err.message });
    } finally {
      setIsCreating(false);
    }
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Checking connection status...</p>
      </Card>
    );
  }

  // ── Backend offline state ──
  if (backendOffline) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 min-h-[300px] text-center">
        <ServerCrash className="h-12 w-12 text-orange-400 mb-4" />
        <h3 className="font-semibold text-lg mb-1">Integration Service Offline</h3>
        <p className="text-muted-foreground text-sm max-w-xs mb-5">
          The Google integration backend is not reachable at <code className="text-xs bg-muted px-1 rounded">localhost:5000</code>. Start it with:
        </p>
        <code className="bg-muted border rounded px-3 py-2 text-xs font-mono mb-5 block">
          cd erp-backend &amp;&amp; node server.js
        </code>
        <Button variant="outline" onClick={() => { setIsLoading(true); checkConnectionStatus(); }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Retry Connection
        </Button>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-white rounded-md shadow-sm border p-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px"><path fill="#7e57c2" d="M12 11h24v24H12z"/><path fill="#ffb74d" d="M30 18H18v-2h12v2zm-4 6H18v-2h8v2zm-2 6H18v-2h6v2z"/><path fill="#fff" d="M12 7h24v4H12zM12 33h24v4H12z"/></svg>
            </div>
            <div>
              <CardTitle>Google Forms Integration</CardTitle>
              <CardDescription>
                {isLinked ? "Your Google Workspace is actively connected." : "Connect your workspace to generate quizzes directly."}
              </CardDescription>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            {isLinked && !needsReconnect && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </div>
            )}
            {isLinked && (
              <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-muted-foreground hover:text-destructive h-8 px-2">
                <Unlink className="w-3.5 h-3.5 mr-1" /> Disconnect
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col min-h-[250px] p-6 space-y-6">
        {/* ── Needs reconnect banner ── */}
        {needsReconnect && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-amber-700 dark:text-amber-400 text-sm">Re-authorization Required</h4>
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
                Your connected account needs updated Google Forms permissions. Please disconnect and reconnect.
              </p>
            </div>
            <Button size="sm" onClick={() => { handleDisconnect().then(handleConnect); }} className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white">
              Reconnect
            </Button>
          </div>
        )}

        {/* ── Not linked ── */}
        {!isLinked ? (
          <div className="flex flex-col items-center justify-center flex-1 space-y-4 max-w-sm mx-auto text-center">
            <p className="text-muted-foreground text-sm">
              Linking your Google account lets you create quizzes and pull student responses directly in the ERP grading system.
            </p>
            <Button onClick={handleConnect} className="w-full h-11">
              Authorize Google Workspace
            </Button>
          </div>
        ) : (
          /* ── Forms Hub ── */
          <div className="w-full space-y-5">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-lg font-semibold">Your Forms Hub</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadForms} disabled={isSyncing}>
                  {isSyncing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {!isSyncing && <RefreshCw className="w-4 h-4 mr-2" />}
                  Sync
                </Button>

                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" /> Create New
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Google Form</DialogTitle>
                      <DialogDescription>
                        A new blank Google Form will be created in your Drive. You can then add questions directly in Google Forms.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <div>
                        <Label htmlFor="formTitle">Form Title</Label>
                        <Input
                          id="formTitle"
                          placeholder="e.g. Mid-Term Quiz – Maths"
                          value={newFormTitle}
                          onChange={(e) => setNewFormTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateForm()}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleCreateForm} disabled={isCreating}>
                        {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Form
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* ── Form list ── */}
            {formsLoaded ? (
              forms.length > 0 ? (
                <div className="grid gap-3">
                  {forms.map((f, i) => (
                    <div key={i} className="flex justify-between items-center p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm truncate">{f.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last modified: {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" asChild className="flex-shrink-0 ml-3">
                        <a href={f.webViewLink} target="_blank" rel="noreferrer">
                          Open <ExternalLink className="w-3 h-3 ml-1.5" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground">
                  <FileVideo2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No forms yet</p>
                  <p className="text-sm mt-1">Create your first form using the "Create New" button.</p>
                </div>
              )
            ) : (
              <div
                className="py-14 bg-muted/10 text-center rounded-lg border border-dashed text-muted-foreground text-sm cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={loadForms}
              >
                Click <strong>Sync</strong> to pull your Google Forms from Drive.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
