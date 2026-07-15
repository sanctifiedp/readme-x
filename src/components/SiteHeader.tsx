import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Moon, Sun, LogOut, Heart, MessageCircle, Menu, X, MessageSquareText, UserCircle, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { initTheme, toggleTheme, isDark } from "@/lib/theme";

const WA_URL = "https://wa.me/2349064887865";
export const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdSYgpAaMAFZXmw0HSl38jzQ7DGoogXiR9BVrcCOxDHgyTZ9Q/viewform";

type MiniProfile = { full_name: string | null; username: string | null; avatar_url: string | null };

function initials(name?: string | null, fallback?: string | null) {
  const source = name || fallback || "?";
  return source.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

export function SiteHeader() {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [profile, setProfile] = useState<MiniProfile | null>(null);
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    initTheme();
    setDark(isDark());
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase.from("profiles")
      .select("full_name, username, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile((data as MiniProfile) ?? null));
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const displayName = profile?.full_name || (profile?.username ? `@${profile.username}` : user?.email?.split("@")[0]) || "You";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="tracking-tight">ReadMe</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link to="/" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Home</Link>
          <Link to="/courses" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Practice</Link>
          <Link to="/tournaments" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Tournaments</Link>
          <Link to="/notes" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Notes</Link>
          <Link to="/donate" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Donate</Link>
          {user && (
            <>
              <Link to="/dashboard" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Dashboard</Link>
              <Link to="/friends" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Friends</Link>
              <Link to="/challenges" search={{}} className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Challenges</Link>
              <Link to="/chat" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Chat</Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="hidden lg:inline-flex">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <MessageSquareText className="h-4 w-4" /> Feedback
            </Button>
          </a>
          <a href={WA_URL} target="_blank" rel="noreferrer" className="hidden sm:inline-flex">
            <Button variant="default" size="sm" className="gap-1.5">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </a>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { toggleTheme(); setDark(isDark()); }}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border/60 pl-1 pr-2 py-1 hover:bg-accent transition" aria-label="Account menu">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                    <AvatarFallback className="text-xs">{initials(profile?.full_name, user.email)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium max-w-[120px] truncate">{displayName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="truncate">{displayName}</span>
                  {profile?.username && <span className="text-xs text-muted-foreground font-normal">@{profile.username}</span>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer"><UserCircle className="h-4 w-4 mr-2" /> View profile</Link>
                </DropdownMenuItem>
                {profile?.username && (
                  <DropdownMenuItem asChild>
                    <Link to="/u/$username" params={{ username: profile.username }} className="cursor-pointer">
                      <UserCircle className="h-4 w-4 mr-2" /> Public page
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer"><Settings className="h-4 w-4 mr-2" /> Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/donate" className="cursor-pointer"><Heart className="h-4 w-4 mr-2" /> Donate</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth" className="hidden sm:inline-flex">
              <Button size="sm">Sign in</Button>
            </Link>
          )}

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="md:hidden border-t border-border/60 bg-background px-4 py-2 flex flex-col">
          <Link to="/" onClick={() => setOpen(false)} className="py-2 text-sm">Home</Link>
          <Link to="/courses" onClick={() => setOpen(false)} className="py-2 text-sm">Practice</Link>
          <Link to="/tournaments" onClick={() => setOpen(false)} className="py-2 text-sm">Tournaments</Link>
          <Link to="/notes" onClick={() => setOpen(false)} className="py-2 text-sm">Notes</Link>
          <Link to="/donate" onClick={() => setOpen(false)} className="py-2 text-sm">Donate</Link>
          {user && (
            <>
              <Link to="/dashboard" onClick={() => setOpen(false)} className="py-2 text-sm">Dashboard</Link>
              <Link to="/friends" onClick={() => setOpen(false)} className="py-2 text-sm">Friends</Link>
              <Link to="/challenges" search={{}} onClick={() => setOpen(false)} className="py-2 text-sm">Challenges</Link>
              <Link to="/chat" onClick={() => setOpen(false)} className="py-2 text-sm">Chat</Link>
              <Link to="/profile" onClick={() => setOpen(false)} className="py-2 text-sm">Profile</Link>
              <Link to="/settings" onClick={() => setOpen(false)} className="py-2 text-sm">Settings</Link>
            </>
          )}
          <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="py-2 text-sm">Give feedback</a>
          {user ? (
            <button onClick={handleSignOut} className="py-2 text-sm text-left">Sign out</button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="py-2 text-sm">Sign in</Link>
          )}
        </nav>
      )}
    </header>
  );
}
