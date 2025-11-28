import { Bell } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { tokenManager, activity } from "@/lib/api";

interface Activity {
  id: string;
  type: 'deposit' | 'withdrawal' | 'mining' | 'package' | 'referral';
  title: string;
  amount?: number;
  status?: string;
  timestamp: string;
}

export default function NotificationBell() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchActivities();
    }
  }, [open]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();
      if (!token) return;

      const response = await activity.getFeed(token);
      setActivities(response.activities || []);
      // Mark first 5 as "new" for unread indicator
      setUnreadCount(Math.min(response.activities?.length || 0, 5));
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return '📥';
      case 'withdrawal':
        return '📤';
      case 'mining':
        return '⛏️';
      case 'package':
        return '📦';
      case 'referral':
        return '👥';
      default:
        return '📢';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 hover:bg-secondary rounded-lg transition-colors">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <h3 className="font-semibold">Notifications</h3>
          <p className="text-xs text-muted-foreground">Recent activity</p>
        </div>

        {/* Activities List */}
        <div className="overflow-y-auto flex-grow">
          {loading ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <p>Loading...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="px-4 py-3 hover:bg-secondary transition-colors border-b border-border/50 last:border-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{getActivityIcon(activity.type)}</span>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <div className="flex items-center justify-between mt-1">
                        {activity.amount !== undefined && (
                          <p className="text-xs font-semibold text-primary">
                            {activity.type === 'withdrawal' ? '-' : '+'}${(parseFloat(String(activity.amount)) || 0).toFixed(2)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatTime(activity.timestamp)}
                        </p>
                      </div>
                      {activity.status && (
                        <p className="text-xs text-muted-foreground capitalize mt-1">
                          Status: {activity.status}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
