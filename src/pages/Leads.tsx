import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Lead {
  id: string;
  name: string;
  email: string;
  channel_name: string | null;
  platform: string | null;
  youtube_url: string | null;
  niche: string | null;
  last_posted: string | null;
  ability_to_pay_analysis: string | null;
  status: string;
  created_at: string;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [youtubeUrls, setYoutubeUrls] = useState("");
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const anySelected = selectedIds.size > 0;

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [emailSubject, setEmailSubject] = useState("Quick question about your channel, {name}");
  const [emailBody, setEmailBody] = useState(
    "Hey {name},\n\nI help creators like you at {channel_name} save 5-10 hours/week with editing. Would you be open to a quick call to see if I can help streamline your workflow?\n\n– Your Name"
  );
  const [sendingEmail, setSendingEmail] = useState(false);

  // Batch sending state after analysis
  const [newlyAddedLeads, setNewlyAddedLeads] = useState<Pick<Lead, 'id' | 'name' | 'email' | 'channel_name'>[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchSubject, setBatchSubject] = useState("Quick question about your channel, {name}");
  const [batchBody, setBatchBody] = useState(
    "Hey {name},\n\nI help creators like you at {channel_name} save 5-10 hours/week with editing. Would you be open to a quick call to see if I can help streamline your workflow?\n\n– Your Name"
  );
  const [batchSending, setBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{sent:number; total:number}>({sent:0, total:0});

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error: any) {
      toast.error("Failed to load leads");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const moveSelectedToCampaigns = async () => {
    if (!anySelected) return;
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('leads')
        .update({ status: 'campaign' })
        .in('id', ids);
      if (error) throw error;
      toast.success(`Moved ${ids.length} lead(s) to campaigns`);
      setSelectedIds(new Set());
      fetchLeads();
    } catch (e: any) {
      toast.error(e.message || 'Failed to move to campaigns');
    }
  };

  const sendColdEmailsSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Select at least one lead');
      return;
    }
    setBatchSending(true);
    setBatchProgress({ sent: 0, total: ids.length });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to send emails');
        return;
      }
      const targets = leads.filter(l => ids.includes(l.id));
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        try {
          const { error: invokeError } = await supabase.functions.invoke('send-outreach-email', {
            body: {
              leadEmail: t.email,
              leadName: t.name,
              channelName: t.channel_name,
              templateSubject: batchSubject,
              templateBody: batchBody,
            }
          });
          if (invokeError) throw invokeError;

          await supabase.from('emails').insert([
            {
              user_id: user.id,
              lead_id: t.id,
              subject: batchSubject,
              body: batchBody,
              status: 'sent',
              sent_at: new Date().toISOString(),
            }
          ]);

          await supabase
            .from('leads')
            .update({ status: 'contacted', last_contacted: new Date().toISOString() })
            .eq('id', t.id);
        } catch (e) {
          await supabase.from('emails').insert([
            {
              user_id: user.id,
              lead_id: t.id,
              subject: batchSubject,
              body: batchBody,
              status: 'failed',
              error_message: (e as any)?.message || 'Unknown error',
            }
          ]);
        } finally {
          setBatchProgress({ sent: i + 1, total: targets.length });
        }
      }
      toast.success(`Finished sending to ${targets.length} selected lead(s)`);
      setSelectedIds(new Set());
      fetchLeads();
    } catch (error: any) {
      toast.error(error.message || 'Batch send failed');
    } finally {
      setBatchSending(false);
    }
  };

  const enrichSelectedWithAI = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Select at least one lead');
      return;
    }
    const targets = leads.filter(l => ids.includes(l.id) && l.youtube_url);
    if (targets.length === 0) {
      toast.error('Selected leads have no YouTube URLs');
      return;
    }
    setAnalyzing(true);
    try {
      for (const t of targets) {
        const { data, error } = await supabase.functions.invoke('analyze-youtube-channels', {
          body: { urls: [t.youtube_url] }
        });
        if (error) throw error;
        const enriched = (data as any)?.leads?.[0];
        if (enriched) {
          let lastPosted: string | null = null;
          if (enriched.last_posted && enriched.last_posted !== 'Unknown' && enriched.last_posted !== 'recent estimate') {
            const d = new Date(enriched.last_posted);
            if (!isNaN(d.getTime())) lastPosted = d.toISOString();
          }
          await supabase
            .from('leads')
            .update({
              email: enriched.email || t.email,
              channel_name: enriched.channel_name ?? t.channel_name,
              niche: enriched.niche ?? t.niche,
              last_posted: lastPosted,
              ability_to_pay_analysis: enriched.ability_to_pay_analysis ?? t.ability_to_pay_analysis,
            })
            .eq('id', t.id);
        }
      }
      toast.success(`Enriched ${targets.length} lead(s)`);
      fetchLeads();
    } catch (e: any) {
      toast.error(e.message || 'AI enrichment failed');
    } finally {
      setAnalyzing(false);
    }
  };
  const handleAnalyzeChannels = async () => {
    if (!youtubeUrls.trim()) {
      toast.error("Please paste YouTube channel URLs");
      return;
    }

    setAnalyzing(true);
    try {
      const urls = youtubeUrls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      console.log('Analyzing URLs:', urls);

      const { data, error } = await supabase.functions.invoke('analyze-youtube-channels', {
        body: { urls }
      });

      if (error) throw error;

      console.log('Analysis result:', data);

      if (data.leads && data.leads.length > 0) {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("You must be logged in to save leads");
          return;
        }

        // Insert leads into database
        const leadsToInsert = data.leads.map((lead: any) => {
          // Parse date properly - convert to ISO string or null
          let lastPosted = null;
          if (lead.last_posted && lead.last_posted !== 'Unknown' && lead.last_posted !== 'recent estimate') {
            try {
              const date = new Date(lead.last_posted);
              if (!isNaN(date.getTime())) {
                lastPosted = date.toISOString();
              }
            } catch (e) {
              console.log('Could not parse date:', lead.last_posted);
            }
          }

          return {
            user_id: user.id,
            name: lead.name,
            email: lead.email,
            channel_name: lead.channel_name,
            platform: lead.platform,
            youtube_url: lead.youtube_url,
            niche: lead.niche,
            last_posted: lastPosted,
            ability_to_pay_analysis: lead.ability_to_pay_analysis,
            status: 'new'
          };
        });

        const { data: inserted, error: insertError } = await supabase
          .from("leads")
          .insert(leadsToInsert)
          .select("id,name,email,channel_name");

        if (insertError) throw insertError;

        const addedCount = inserted ? inserted.length : 0;
        toast.success(`Successfully analyzed and added ${addedCount} leads!`);
        setNewlyAddedLeads(inserted || []);
        setYoutubeUrls("");
        fetchLeads();
      } else {
        toast.error("No leads found in analysis");
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || "Failed to analyze channels");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;

    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Lead deleted successfully");
      fetchLeads();
    } catch (error: any) {
      toast.error("Failed to delete lead");
      console.error(error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const openSendDialog = (lead: Lead) => {
    setSelectedLead(lead);
    // Pre-fill subject/body with placeholders; personalization handled server-side
    setEmailSubject("Quick question about your channel, {name}");
    setEmailBody(
      "Hey {name},\n\nI help creators like you at {channel_name} save 5-10 hours/week with editing. Would you be open to a quick call to see if I can help streamline your workflow?\n\n– Your Name"
    );
    setSendDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedLead) return;
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    setSendingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to send emails");
        return;
      }

      const { error: invokeError } = await supabase.functions.invoke('send-outreach-email', {
        body: {
          leadEmail: selectedLead.email,
          leadName: selectedLead.name,
          channelName: selectedLead.channel_name,
          templateSubject: emailSubject,
          templateBody: emailBody,
        }
      });

      if (invokeError) throw invokeError;

      // Log email and update lead status
      await supabase.from('emails').insert([
        {
          user_id: user.id,
          lead_id: selectedLead.id,
          subject: emailSubject,
          body: emailBody,
          status: 'sent',
          sent_at: new Date().toISOString(),
        }
      ]);

      await supabase
        .from('leads')
        .update({ status: 'contacted', last_contacted: new Date().toISOString() })
        .eq('id', selectedLead.id);

      toast.success("Email sent successfully");
      setSendDialogOpen(false);
      setSelectedLead(null);
      fetchLeads();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleBatchSend = async () => {
    const selectedArray = Array.from(selectedIds);
    const targets = selectedArray.length > 0
      ? leads.filter(l => selectedArray.includes(l.id)).map(l => ({ id: l.id, name: l.name, email: l.email, channel_name: l.channel_name }))
      : (newlyAddedLeads.length > 0 ? newlyAddedLeads : leads.filter(l => l.status === 'new').map(l => ({ id: l.id, name: l.name, email: l.email, channel_name: l.channel_name })));
    if (targets.length === 0) {
      toast.error('No leads to send to');
      return;
    }
    setBatchSending(true);
    setBatchProgress({sent:0, total:targets.length});
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to send emails");
        return;
      }

      // Send sequentially to avoid SMTP throttling
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        try {
          const { error: invokeError } = await supabase.functions.invoke('send-outreach-email', {
            body: {
              leadEmail: t.email,
              leadName: t.name,
              channelName: t.channel_name,
              templateSubject: batchSubject,
              templateBody: batchBody,
            }
          });
          if (invokeError) throw invokeError;

          await supabase.from('emails').insert([
            {
              user_id: user.id,
              lead_id: t.id,
              subject: batchSubject,
              body: batchBody,
              status: 'sent',
              sent_at: new Date().toISOString(),
            }
          ]);

          await supabase
            .from('leads')
            .update({ status: 'contacted', last_contacted: new Date().toISOString() })
            .eq('id', t.id);
        } catch (e) {
          // Log failure
          await supabase.from('emails').insert([
            {
              user_id: user.id,
              lead_id: t.id,
              subject: batchSubject,
              body: batchBody,
              status: 'failed',
              error_message: (e as any)?.message || 'Unknown error',
            }
          ]);
        } finally {
          setBatchProgress({sent: i+1, total: targets.length});
        }
      }

      toast.success(`Finished sending to ${targets.length} lead(s)`);
      setBatchDialogOpen(false);
      setNewlyAddedLeads([]);
      fetchLeads();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Batch send failed');
    } finally {
      setBatchSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Lead Analyzer</h1>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Paste YouTube Channel URLs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="youtube-urls">
              Paste anything - URLs, channel names, whole pages with creator info
            </Label>
            <Textarea
              id="youtube-urls"
              placeholder="Paste anything with YouTube channels:&#10;&#10;- Channel URLs: youtube.com/@channelname&#10;- Channel names: @MrBeast, @MKBHD&#10;- Whole pages with multiple channels&#10;- Lists of creators&#10;&#10;AI will find and analyze all channels automatically!"
              value={youtubeUrls}
              onChange={(e) => setYoutubeUrls(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
          <Button 
            onClick={handleAnalyzeChannels} 
            disabled={analyzing || !youtubeUrls.trim()}
            className="w-full"
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze Channels with AI
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            AI will automatically extract channels from any text and analyze: Name, Email, Niche, Last Posted, Payment Ability
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Analyzed Leads ({leads.length})</h2>
              {leads.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} id="select-all" />
                    <Label htmlFor="select-all">Select all</Label>
                  </div>
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                  <Button variant="secondary" size="sm" onClick={moveSelectedToCampaigns} disabled={!anySelected}>Move to Campaigns</Button>
                  <Button variant="secondary" size="sm" onClick={enrichSelectedWithAI} disabled={!anySelected || analyzing}>
                    {analyzing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enriching...</>) : 'AI Enrich'}
                  </Button>
                  <Button variant="default" size="sm" onClick={() => setBatchDialogOpen(true)} disabled={!anySelected}>Send Cold Emails</Button>
                </div>
              )}
            </div>
          </div>
          {newlyAddedLeads.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-medium">{newlyAddedLeads.length} new lead(s) added.</p>
                    <p className="text-sm text-muted-foreground">Click Next to compose and send your message.</p>
                  </div>
                  <Button onClick={() => setBatchDialogOpen(true)}>Next: Send messages</Button>
                </div>
              </CardContent>
            </Card>
          )}
          {leads.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">
                  No leads yet. Paste YouTube URLs above to get started!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {leads.map((lead) => (
                <Card key={lead.id} className="hover:shadow-elevated transition-all">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-start gap-3 w-full">
                        <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelectOne(lead.id)} />
                        <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{lead.name}</h3>
                          <Badge variant="outline">{lead.status}</Badge>
                          {lead.platform && (
                            <Badge className="bg-primary/10 text-primary border-primary/20">
                              {lead.platform}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Email:</span>{" "}
                            <span className="text-foreground">{lead.email}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Channel:</span>{" "}
                            <span className="text-foreground">{lead.channel_name || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Niche:</span>{" "}
                            <span className="text-foreground">{lead.niche || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Last Posted:</span>{" "}
                            <span className="text-foreground">{formatDate(lead.last_posted)}</span>
                          </div>
                        </div>

                        {lead.ability_to_pay_analysis && (
                          <div className="p-3 bg-secondary/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Payment Ability Analysis:</p>
                            <p className="text-sm">{lead.ability_to_pay_analysis}</p>
                          </div>
                        )}

                        {lead.youtube_url && (
                          <a
                            href={lead.youtube_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-block"
                          >
                            View Channel →
                          </a>
                        )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openSendDialog(lead)}
                        >
                          Send Email
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(lead.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Email {selectedLead ? `to ${selectedLead.name}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Subject"
              />
              <p className="text-xs text-muted-foreground">You can use placeholders: {"{name}"}, {"{channel_name}"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-body">Body</Label>
              <Textarea
                id="email-body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={8}
              />
            </div>
            <Button onClick={handleSendEmail} disabled={sendingEmail} className="w-full">
              {sendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send message to {newlyAddedLeads.length > 0 ? newlyAddedLeads.length : leads.filter(l=>l.status==='new').length} lead(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-subject">Subject</Label>
              <Input
                id="batch-subject"
                value={batchSubject}
                onChange={(e) => setBatchSubject(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Placeholders supported: {"{name}"}, {"{channel_name}"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-body">Body</Label>
              <Textarea
                id="batch-body"
                rows={8}
                value={batchBody}
                onChange={(e) => setBatchBody(e.target.value)}
              />
            </div>
            <Button onClick={handleBatchSend} disabled={batchSending} className="w-full">
              {batchSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending {batchProgress.sent}/{batchProgress.total}...
                </>
              ) : (
                "Send to all"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
