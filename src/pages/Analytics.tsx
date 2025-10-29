import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface EmailStats {
  total: number;
  sent: number;
  opened: number;
  replied: number;
  failed: number;
}

export default function Analytics() {
  const [emailStats, setEmailStats] = useState<EmailStats>({
    total: 0,
    sent: 0,
    opened: 0,
    replied: 0,
    failed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emails } = await supabase
        .from("emails")
        .select("status")
        .eq("user_id", user.id);

      if (emails) {
        const stats = {
          total: emails.length,
          sent: emails.filter(e => e.status === "sent").length,
          opened: emails.filter(e => e.status === "opened").length,
          replied: emails.filter(e => e.status === "replied").length,
          failed: emails.filter(e => e.status === "failed").length
        };
        setEmailStats(stats);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Emails</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{emailStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{emailStats.sent}</div>
            {emailStats.total > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {Math.round((emailStats.sent / emailStats.total) * 100)}% of total
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Opened</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500">{emailStats.opened}</div>
            {emailStats.sent > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {Math.round((emailStats.opened / emailStats.sent) * 100)}% open rate
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Replied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{emailStats.replied}</div>
            {emailStats.sent > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {Math.round((emailStats.replied / emailStats.sent) * 100)}% reply rate
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{emailStats.failed}</div>
            {emailStats.total > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {Math.round((emailStats.failed / emailStats.total) * 100)}% failure rate
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {emailStats.total === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No email data yet. Start sending campaigns to see analytics here!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
