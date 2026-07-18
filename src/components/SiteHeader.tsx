import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Moon,
  Sun,
  LogOut,
  Heart,
  MessageCircle,
  Menu,
  MessageSquareText,
  UserCircle,
  Settings,
  ChevronDown,
  Home,
  GraduationCap,
  Trophy,
  Users,
  Swords,
  StickyNote,
  MessagesSquare,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

const PRIMARY_LINKS = [
  { to: "/", label: "Home", icon: Home, auth: false },
  { to: "/courses", label: "Practice", icon: GraduationCap, auth: false },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, auth: true },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, auth: true },
] as const;

const MORE_LINKS = [
  { to: "/tournaments", label: "Tournaments", icon: Sparkles, auth: false, search: undefined },
  { to: "/notes", label: "Notes", icon: StickyNote, auth: false, search: undefined },
  { to: "/challenges", label: "Challenges", icon: Swords, auth: true, search: {} as Record<string, never> },
  { to: "/friends", label: "Friends", icon: Users, auth: true, search: undefined },
  { to: "/chat", label: "Chat", icon: MessagesSquare, auth: true, search: undefined },
  { to: "/donate", label: "Donate", icon: Heart, auth: false, search: undefined },
] as const;

export function SiteHeader() {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [profile, setProfile] = useState<MiniProfile | null>(null);
  const [dark, setDark] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    setDrawerOpen(false);
    navigate({ to: "/" });
  };

  const displayName =
    profile?.full_name ||
    (profile?.username ? `@${profile.username}` : user?.email?.split("@")[0]) ||
    "You";

  const primary = PRIMARY_LINKS.filter((l) => !l.auth || user);
  const more = MORE_LINKS.filter((l) => !l.auth || user);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="tracking-tight">ReadMe</span>
        </Link>

        {/* Desktop primary nav */}
        <nav className="hidden md:flex items-center gap-1">
          {primary.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "text-foreground bg-accent" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              activeOptions={{ exact: l.to === "/" }}
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {l.label}
            </Link>
          ))}
          {more.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
                  More <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {more.map((l) => {
                  const Icon = l.icon;
                  return (
                    <DropdownMenuItem asChild key={l.to}>
                      {l.search !== undefined ? (
                        <Link to={l.to} search={l.search as never} className="cursor-pointer">
                          <Icon className="h-4 w-4 mr-2" /> {l.label}
                        </Link>
                      ) : (
                        <Link to={l.to} className="cursor-pointer">
                          <Icon className="h-4 w-4 mr-2" /> {l.label}
                        </Link>
                      )}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="cursor-pointer">
                    <MessageSquareText className="h-4 w-4 mr-2" /> Feedback
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5">
          <a href={WA_URL} target="_blank" rel="noreferrer" className="hidden lg:inline-flex">
            <Button variant="default" size="sm" className="gap-1.5">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </a>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { toggleTheme(); setDark(isDark()); }}
            aria-label="Toggle theme"
            className="min-h-10 min-w-10"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 pl-1 pr-1.5 sm:pr-2 py-1 hover:bg-accent transition min-h-10"
                  aria-label="Account menu"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                    <AvatarFallback className="text-xs">{initials(profile?.full_name, user.email)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium max-w-[110px] truncate hidden sm:inline">{displayName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
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

          {/* Mobile hamburger */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden min-h-10 min-w-10" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] max-w-sm p-0 flex flex-col">
              <SheetHeader className="px-5 py-4 border-b border-border/60">
                <SheetTitle className="flex items-center gap-2 text-left">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  ReadMe
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-2">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Main</div>
                {primary.map((l) => {
                  const Icon = l.icon;
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setDrawerOpen(false)}
                      activeProps={{ className: "bg-accent text-foreground" }}
                      inactiveProps={{ className: "text-muted-foreground hover:bg-accent/60 hover:text-foreground" }}
                      activeOptions={{ exact: l.to === "/" }}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md mx-2 my-0.5 transition-colors"
                    >
                      <Icon className="h-4 w-4" /> {l.label}
                    </Link>
                  );
                })}
                {more.length > 0 && (
                  <>
                    <div className="px-2 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">More</div>
                    {more.map((l) => {
                      const Icon = l.icon;
                      const shared = {
                        onClick: () => setDrawerOpen(false),
                        className:
                          "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md mx-2 my-0.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors",
                      };
                      return l.search !== undefined ? (
                        <Link key={l.to} to={l.to} search={l.search as never} {...shared}>
                          <Icon className="h-4 w-4" /> {l.label}
                        </Link>
                      ) : (
                        <Link key={l.to} to={l.to} {...shared}>
                          <Icon className="h-4 w-4" /> {l.label}
                        </Link>
                      );
                    })}
                  </>
                )}
                <div className="px-2 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Support</div>
                <a
                  href={FEEDBACK_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md mx-2 my-0.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
                >
                  <MessageSquareText className="h-4 w-4" /> Feedback
                </a>
                <a
                  href={WA_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md mx-2 my-0.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </div>
              <div className="border-t border-border/60 p-4">
                {user ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                      <AvatarFallback className="text-xs">{initials(profile?.full_name, user.email)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{displayName}</div>
                      {profile?.username && (
                        <div className="text-xs text-muted-foreground truncate">@{profile.username}</div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">Account</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to="/profile" onClick={() => setDrawerOpen(false)}><UserCircle className="h-4 w-4 mr-2" /> Profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/settings" onClick={() => setDrawerOpen(false)}><Settings className="h-4 w-4 mr-2" /> Settings</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut}>
                          <LogOut className="h-4 w-4 mr-2" /> Sign out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <Link to="/auth" onClick={() => setDrawerOpen(false)} className="block">
                    <Button className="w-full">Sign in</Button>
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
