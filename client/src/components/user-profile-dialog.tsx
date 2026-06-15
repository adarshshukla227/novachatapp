import type { UserType } from "@/types/auth.type";
import { Dialog, DialogContent } from "./ui/dialog";
import { useSocket } from "@/hooks/use-socket";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserType | null;
}

const UserProfileDialog = ({ open, onOpenChange, user }: Props) => {
  // useSocket hook — reactive, re-renders when onlineUsers changes
  const { onlineUsers } = useSocket();
  
  if (!user) return null;

  const online = onlineUsers.includes(user._id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="bg-gradient-to-b from-primary/20 to-background pt-8 pb-4 flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-background shadow-lg">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <span className="text-3xl font-semibold text-primary">
                  {user.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold">{user.name}</h2>
            <p className={`text-xs font-medium mt-0.5 ${online ? "text-green-500" : "text-muted-foreground"}`}>
              {online ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">About</p>
          <p className="text-sm">
            {(user as any).bio || "Hey there! I am using NovaChat."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileDialog;
