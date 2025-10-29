import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, TrendingUp, CheckCircle } from "lucide-react";

interface Stats {
  totalLeads: number;
  emailsSent: number;
  replies: number;
  conversionRate: number;
}

interface RecentActivity {
  id: string;
  lead_name: string;
  action: string;
  timestamp: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    emailsSent: 0,
    replies: 0,
    conversionRate: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch leads count
      const { count: leadsCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Fetch emails stats
      const { data: emailsData } = await supabase
        .from("emails")
        .select("status")
        .eq("user_id", user.id);

      const emailsSent = emailsData?.filter(e => e.status === "sent" || e.status === "opened" || e.status === "replied").length || 0;
      const replies = emailsData?.filter(e => e.status === "replied").length || 0;
      const conversionRate = emailsSent > 0 ? (replies / emailsSent) * 100 : 0;

      // Fetch recent activity
      const { data: recentEmails } = await supabase
        .from("emails")
        .select(`
          id,
          status,
          sent_at,
          leads!inner(name)
        `)
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false })
        .limit(5);

      const activity = recentEmails?.map(email => ({
        id: email.id,
        lead_name: (email.leads as any).name,
        action: email.status,
        timestamp: email.sent_at || ""
      })) || [];

      setStats({
        totalLeads: leadsCount || 0,
        emailsSent,
        replies,
        conversionRate: Math.round(conversionRate)
      });
      setRecentActivity(activity);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Leads"
          value={stats.totalLeads}
          icon={Users}
          trend="neutral"
        />
        <StatCard
          title="Emails Sent"
          value={stats.emailsSent}
          icon={Mail}
          trend="neutral"
        />
        <StatCard
          title="Replies"
          value={stats.replies}
          change={stats.emailsSent > 0 ? `${stats.conversionRate}% conversion` : undefined}
          icon={CheckCircle}
          trend="up"
        />
        <StatCard
          title="Conversion Rate"
          value={`${stats.conversionRate}%`}
          icon={TrendingUp}
          trend={stats.conversionRate > 10 ? "up" : stats.conversionRate > 5 ? "neutral" : "down"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{activity.lead_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{activity.action}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatTimestamp(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No activity yet. Start by adding leads and creating campaigns!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
