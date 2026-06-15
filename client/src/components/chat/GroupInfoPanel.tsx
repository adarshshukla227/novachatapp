import { useEffect, useState } from "react";
import { X, Crown, LogOut } from "lucide-react";
import AvatarWithBadge from "../avatar-with-badge";

interface Member {
  _id: string;
  name: string;
  avatar: string;
  isAdmin: boolean;
}

interface Props {
  chatId: string;
  groupName: string;
  memberCount: number;
  onClose: () => void;
  onLeaveSuccess: (chatId: string) => void;
}

const GroupInfoPanel = ({
  chatId,
  groupName,
  memberCount,
  onClose,
  onLeaveSuccess,
}: Props) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch(`/api/chat/${chatId}/members`, {
          credentials: "include",
        });
        const data = await res.json();
        setMembers(data.members || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [chatId]);

  const handleLeave = async () => {
    setLeaving(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/leave`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        onLeaveSuccess(chatId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLeaving(false);
    }
  };

  return (
    // fixed — poori screen cover karta hai, footer ke upar
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Drawer — full height guaranteed */}
      <div className="relative w-80 h-screen bg-card border-l border-border shadow-2xl flex flex-col z-10">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border bg-primary shrink-0">
          <button onClick={onClose} className="text-primary-foreground hover:opacity-70 transition">
            <X size={20} />
          </button>
          <h2 className="font-semibold text-primary-foreground text-sm">Group Info</h2>
        </div>

        {/* Group avatar + name */}
        <div className="flex flex-col items-center px-4 py-6 border-b border-border gap-2 shrink-0">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {groupName.charAt(0).toUpperCase()}
          </div>
          <h3 className="font-semibold text-base">{groupName}</h3>
          <p className="text-xs text-muted-foreground">
            Group · {memberCount} members
          </p>
        </div>

        {/* Members list — scroll hoga */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <p className="px-4 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {members.length} Members
          </p>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member._id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-sidebar-accent transition-colors"
              >
                <div className="relative flex-shrink-0">
                  <AvatarWithBadge
                    name={member.name}
                    src={member.avatar}
                    isGroup={false}
                    isOnline={false}
                  />
                  {member.isAdmin && (
                    <div className="absolute -bottom-1 -right-1 bg-yellow-400 rounded-full p-0.5 shadow">
                      <Crown size={9} className="text-yellow-900" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  {member.isAdmin && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                      Group Admin
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Leave Group — hamesha bottom mein fixed */}
        <div className="p-4 border-t border-border shrink-0">
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-destructive border border-destructive/30 hover:bg-destructive/5 transition text-sm font-medium"
            >
              <LogOut size={16} />
              Leave Group
            </button>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                "{groupName}"  Are you sure you want to leave?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-sidebar-accent transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeave}
                  disabled={leaving}
                  className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                >
                  {leaving ? "Leaving..." : "Leave"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupInfoPanel;