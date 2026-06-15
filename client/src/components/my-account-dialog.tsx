import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Camera, Loader2, Pencil } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MyAccountDialog = ({ open, onOpenChange }: Props) => {
  const { user, updateProfile, isUpdatingProfile } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form whenever dialog opens (sync with latest user data)
  useEffect(() => {
    if (open) {
      setName(user?.name || "");
      setBio(user?.bio || "");
      setAvatarPreview(null);
      setAvatarBase64(null);
    }
  }, [open, user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setAvatarBase64(result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    const payload: { name?: string; bio?: string; avatar?: string } = {};

    if (name.trim() && name.trim() !== user?.name) {
      payload.name = name.trim();
    }
    if (bio !== user?.bio) {
      payload.bio = bio;
    }
    if (avatarBase64) {
      payload.avatar = avatarBase64;
    }

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }

    const success = await updateProfile(payload);
    if (success) {
      onOpenChange(false);
    }
  };

  const displayAvatar = avatarPreview || user?.avatar || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>My Account</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* ── Profile Picture ── */}
          <div className="relative">
            <div
              className="w-28 h-28 rounded-full overflow-hidden border-2 border-border
              flex items-center justify-center bg-muted cursor-pointer
              hover:opacity-90 transition"
              onClick={handleAvatarClick}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-semibold text-muted-foreground">
                  {name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}
            </div>

            {/* Camera overlay button */}
            <button
              onClick={handleAvatarClick}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full
              bg-primary text-primary-foreground flex items-center justify-center
              border-2 border-background shadow-sm hover:opacity-90 transition"
            >
              <Camera className="w-4 h-4" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <p className="text-xs text-muted-foreground -mt-1">
            Tap the camera icon to change your photo
          </p>

          {/* ── Name ── */}
          <div className="w-full space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Pencil className="w-3 h-3" /> Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
            />
          </div>

          {/* ── Bio / About ── */}
          <div className="w-full space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Pencil className="w-3 h-3" /> About
            </label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Hey there! I am using NovaChat."
              maxLength={150}
              rows={3}
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {bio.length}/150
            </p>
          </div>

          {/* ── Email (read-only) ── */}
          <div className="w-full space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <Input value={user?.email || ""} disabled className="opacity-60" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdatingProfile}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isUpdatingProfile}>
            {isUpdatingProfile && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MyAccountDialog;
