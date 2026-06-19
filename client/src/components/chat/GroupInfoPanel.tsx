import { useEffect, useRef, useState } from "react";
import { X, Crown, LogOut, Camera, Plus, Trash2, Search, Pencil, Check } from "lucide-react";
import AvatarWithBadge from "../avatar-with-badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Group info state
  const [currentGroupName, setCurrentGroupName] = useState(groupName);
  const [description, setDescription] = useState("");
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Edit states
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [tempName, setTempName] = useState(groupName);
  const [tempDesc, setTempDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState<{ _id: string; name: string; avatar: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // Clear chat state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch members ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch(`/api/chat/${chatId}/members`, {
          credentials: "include",
        });
        const data = await res.json();
        setMembers(data.members || []);

        // Check if current user is admin
        const me = data.members?.find((m: Member) => m._id === user?._id);
        setIsAdmin(me?.isAdmin || false);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [chatId, user?._id]);

  // ─── Fetch group info (description, avatar) ───────────────────────────────
  useEffect(() => {
    const fetchGroupInfo = async () => {
      try {
        const res = await fetch(`/api/chat/${chatId}`, {
          credentials: "include",
        });
        const data = await res.json();
        const chat = data.chat;
        if (chat?.groupDescription) {
          setDescription(chat.groupDescription);
          setTempDesc(chat.groupDescription);
        }
        if (chat?.groupAvatar) setGroupAvatar(chat.groupAvatar);
        if (chat?.groupName) {
          setCurrentGroupName(chat.groupName);
          setTempName(chat.groupName);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchGroupInfo();
  }, [chatId]);

  // ─── Save group info ──────────────────────────────────────────────────────
  const saveGroupInfo = async (updates: {
    groupName?: string;
    groupDescription?: string;
    groupAvatar?: string;
  }) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/group-info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Group updated successfully");
    } catch {
      toast.error("Failed to update group info");
    } finally {
      setSaving(false);
    }
  };

  // ─── Group avatar change ──────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setGroupAvatar(base64);
      await saveGroupInfo({ groupAvatar: base64 });
    };
    reader.readAsDataURL(file);
  };

  // ─── Save name ────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    setCurrentGroupName(tempName);
    setEditingName(false);
    await saveGroupInfo({ groupName: tempName });
  };

  // ─── Save description ─────────────────────────────────────────────────────
  const handleSaveDesc = async () => {
    setDescription(tempDesc);
    setEditingDesc(false);
    await saveGroupInfo({ groupDescription: tempDesc });
  };

  // ─── Add member ───────────────────────────────────────────────────────────
  const fetchAllUsers = async () => {
    try {
      const res = await fetch("/api/user/all", { credentials: "include" });
      const data = await res.json();
      // Filter out already existing members
      const existingIds = members.map((m) => m._id);
      setAllUsers(
        (data.users || []).filter((u: any) => !existingIds.includes(u._id))
      );
    } catch {
      toast.error("Failed to fetch users");
    }
  };

  const handleShowAddMember = async () => {
    setShowAddMember(true);
    await fetchAllUsers();
  };

  const handleAddMember = async (memberId: string) => {
    setAddingMember(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/add-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast.success("Member added successfully");
      // Refresh members list
      const newMember = (data.chat?.participants || []).find(
        (p: any) => p._id === memberId
      );
      if (newMember) {
        setMembers((prev) => [...prev, { ...newMember, isAdmin: false }]);
      }
      setShowAddMember(false);
      setSearchQuery("");
    } catch {
      toast.error("Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  // ─── Clear chat ───────────────────────────────────────────────────────────
  const handleClearChat = async () => {
    setClearing(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/clear`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Chat cleared successfully");
      setShowClearConfirm(false);
      onClose();
    } catch {
      toast.error("Failed to clear chat");
    } finally {
      setClearing(false);
    }
  };

  // ─── Leave group ──────────────────────────────────────────────────────────
  const handleLeave = async () => {
    setLeaving(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/leave`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) onLeaveSuccess(chatId);
    } catch (err) {
      console.error(err);
    } finally {
      setLeaving(false);
    }
  };

  const filteredUsers = allUsers.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-80 h-screen bg-card border-l border-border shadow-2xl flex flex-col z-10 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border bg-primary shrink-0 sticky top-0 z-10">
          <button onClick={onClose} className="text-primary-foreground hover:opacity-70 transition">
            <X size={20} />
          </button>
          <h2 className="font-semibold text-primary-foreground text-sm">Group Info</h2>
        </div>

        {/* Group avatar + name + description */}
        <div className="flex flex-col items-center px-4 py-6 border-b border-border gap-3">

          {/* Avatar with camera button */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary overflow-hidden">
              {groupAvatar ? (
                <img src={groupAvatar} alt="group" className="w-full h-full object-cover" />
              ) : (
                currentGroupName.charAt(0).toUpperCase()
              )}
            </div>
            {isAdmin && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md hover:opacity-90 transition"
                >
                  <Camera size={13} className="text-white" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </>
            )}
          </div>

          {/* Group name */}
          <div className="w-full text-center">
            {editingName ? (
              <div className="flex items-center gap-2 px-2">
                <input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="flex-1 text-center text-base font-semibold bg-muted rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
                <button onClick={handleSaveName} disabled={saving} className="text-primary hover:opacity-70">
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h3 className="font-semibold text-base">{currentGroupName}</h3>
                {isAdmin && (
                  <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground transition">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              Group · {memberCount} members
            </p>
          </div>

          {/* Description */}
          <div className="w-full">
            {editingDesc ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={tempDesc}
                  onChange={(e) => setTempDesc(e.target.value)}
                  placeholder="Add group description..."
                  className="w-full text-sm bg-muted rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingDesc(false); setTempDesc(description); }}
                    className="flex-1 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDesc}
                    disabled={saving}
                    className="flex-1 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => isAdmin && setEditingDesc(true)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                  isAdmin ? "hover:bg-muted cursor-pointer" : "cursor-default"
                }`}
              >
                {description ? (
                  <span className="text-foreground">{description}</span>
                ) : (
                  <span className="text-primary font-medium">
                    {isAdmin ? "+ Add group description" : "No description"}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Action buttons — Add member, Search, Clear chat */}
        <div className="grid grid-cols-3 gap-2 px-4 py-4 border-b border-border">
          {isAdmin && (
            <button
              onClick={handleShowAddMember}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted hover:bg-muted/70 transition"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus size={18} className="text-primary" />
              </div>
              <span className="text-xs font-medium">Add</span>
            </button>
          )}

          <button
            onClick={() => { toast.info("Search coming soon!"); }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted hover:bg-muted/70 transition"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Search size={18} className="text-primary" />
            </div>
            <span className="text-xs font-medium">Search</span>
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted hover:bg-muted/70 transition"
          >
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <Trash2 size={18} className="text-destructive" />
            </div>
            <span className="text-xs font-medium text-destructive">Clear</span>
          </button>
        </div>

        {/* Add member panel */}
        {showAddMember && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold flex-1">Add Member</h4>
              <button onClick={() => { setShowAddMember(false); setSearchQuery(""); }} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full text-sm bg-muted rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 mb-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No users found</p>
              ) : (
                filteredUsers.map((u) => (
                  <div key={u._id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition">
                    <AvatarWithBadge name={u.name} src={u.avatar} isOnline={false} />
                    <span className="text-sm flex-1 truncate">{u.name}</span>
                    <button
                      onClick={() => handleAddMember(u._id)}
                      disabled={addingMember}
                      className="text-xs px-3 py-1 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Members list */}
        <div className="flex-1">
          <p className="px-4 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {members.length} Members
          </p>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            members.map((member) => (
              <div key={member._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-sidebar-accent transition-colors">
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
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Group Admin</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Clear chat confirm */}
        {showClearConfirm && (
          <div className="px-4 py-4 border-t border-border bg-card">
            <p className="text-sm text-muted-foreground text-center mb-3">
              Clear all messages in this chat?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                disabled={clearing}
                className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {clearing ? "Clearing..." : "Clear"}
              </button>
            </div>
          </div>
        )}

        {/* Leave Group */}
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
                "{currentGroupName}" Are you sure you want to leave?
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