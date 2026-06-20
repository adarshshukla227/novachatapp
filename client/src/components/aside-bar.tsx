import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "./theme-provider";
import { isUserOnline } from "@/lib/helper";
import Logo from "./logo";
import { PROTECTED_ROUTES } from "@/routes/routes";
import { Button } from "./ui/button";
import { Moon, Sun, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import AvatarWithBadge from "./avatar-with-badge";
import MyAccountDialog from "./my-account-dialog";

const AsideBar = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showMyAccount, setShowMyAccount] = useState(false);

  const isOnline = isUserOnline(user?._id);

  return (
    <>
      <aside
        className="
          fixed inset-y-0 left-0 z-[9999]
          w-14 md:w-11
          h-svh bg-primary/85 shadow-sm
          flex flex-col items-center
          pt-2 pb-6 px-1
        "
      >
        <div className="w-full h-full flex flex-col items-center justify-between">
          {/* Logo */}
          <Logo
            url={PROTECTED_ROUTES.CHAT}
            imgClass="size-8 md:size-7"
            textClass="text-white"
            showText={false}
          />

          {/* Bottom actions */}
          <div className="flex flex-col items-center gap-4">
            {/* Theme toggle */}
            <Button
              variant="outline"
              size="icon"
              className="border-0 rounded-full w-9 h-9 md:w-8 md:h-8"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <Sun className="h-5 w-5 md:h-[1.2rem] md:w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute h-5 w-5 md:h-[1.2rem] md:w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:-rotate-0" />
            </Button>

            {/* Avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div role="button">
                  <AvatarWithBadge
                    name={user?.name || "unKnown"}
                    src={user?.avatar || ""}
                    isOnline={isOnline}
                    className="!bg-white"
                  />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg z-[99999]"
                align="end"
              >
                <DropdownMenuItem
                  onClick={() => setShowMyAccount(true)}
                  className="cursor-pointer"
                >
                  <User className="w-4 h-4 mr-2" />
                  My Account
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      <MyAccountDialog open={showMyAccount} onOpenChange={setShowMyAccount} />
    </>
  );
};

export default AsideBar;
