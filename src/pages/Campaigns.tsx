import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Mail } from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_leads: number;
  sent_count: number;
  created_at: string;
}

export default function Campaigns() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  const [templateForm, setTemplateForm] = useState({
    name: "",
    subject: "",
    body: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [templatesRes, campaignsRes] = await Promise.all([
        supabase
          .from("templates")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("campaigns")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
      ]);

      if (templatesRes.error) throw templatesRes.error;
      if (campaignsRes.error) throw campaignsRes.error;

      setTemplates(templatesRes.data || []);
      setCampaigns(campaignsRes.data || []);
    } catch (error: any) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("templates")
        .insert([{ ...templateForm, user_id: user.id }]);

      if (error) throw error;

      toast.success("Template created successfully");
      setTemplateForm({ name: "", subject: "", body: "" });
      setIsTemplateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to create template");
    }
  };

  const statusColors: { [key: string]: string } = {
    draft: "bg-gray-500",
    active: "bg-blue-500",
    completed: "bg-green-500",
    paused: "bg-yellow-500"
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Campaigns</h1>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Email Template</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTemplate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Template Name *</Label>
                    <Input
                      id="template-name"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      placeholder="e.g., Creator Outreach"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject Line *</Label>
                    <Input
                      id="subject"
                      value={templateForm.subject}
                      onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                      placeholder="e.g., Quick question about {{channel_name}}"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="body">Email Body *</Label>
                    <Textarea
                      id="body"
                      value={templateForm.body}
                      onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                      placeholder="Hey {{name}},&#10;&#10;I checked out your {{channel_name}} — love your {{platform}} content!&#10;&#10;Use {{name}}, {{email}}, {{channel_name}}, {{platform}} as placeholders"
                      rows={10}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Available placeholders: {"{"}{"{"} name {"}"}{"}"}, {"{"}{"{"} email {"}"}{"}"}, {"{"}{"{"} channel_name {"}"}{"}"}, {"{"}{"{"} platform {"}"}{"}"}
                    </p>
                  </div>
                  <Button type="submit" className="w-full">
                    Create Template
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid gap-4">
              {templates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription>{template.subject}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {template.body.substring(0, 200)}
                      {template.body.length > 200 && "..."}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {templates.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No templates yet. Create your first email template to get started!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardContent className="p-12 text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Campaign sending functionality coming soon! Create templates and add leads to get ready.
              </p>
              <p className="text-sm text-muted-foreground">
                This will allow you to send automated email campaigns to your leads using your templates.
              </p>
            </CardContent>
          </Card>

          {campaigns.length > 0 && (
            <div className="grid gap-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{campaign.name}</CardTitle>
                        <CardDescription>
                          {campaign.sent_count} / {campaign.total_leads} emails sent
                        </CardDescription>
                      </div>
                      <Badge className={statusColors[campaign.status]}>
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
