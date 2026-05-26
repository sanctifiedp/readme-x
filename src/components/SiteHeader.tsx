import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Moon, Sun, LogOut, Heart, MessageCircle, Menu, X, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { initTheme, toggleTheme, isDark } from "@/lib/theme";

const WA_URL = "https://wa.me/2349064887865";
export const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdSYgpAaMAFZXmw0HSl38jzQ7DGoogXiR9BVrcCOxDHgyTZ9Q/viewform";

export function SiteHeader() {
  const [user, setUser] = useState<{ email?: string | null } | null>(null);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

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
          <Link to="/notes" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Notes</Link>
          <Link to="/donate" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Donate</Link>
          {user && (
            <>
              <Link to="/dashboard" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Dashboard</Link>
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
          <Link to="/donate" className="hidden sm:inline-flex">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Heart className="h-4 w-4" /> Donate
            </Button>
          </Link>
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
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5 hidden sm:inline-flex">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
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
          <Link to="/notes" onClick={() => setOpen(false)} className="py-2 text-sm">Notes</Link>
          <Link to="/donate" onClick={() => setOpen(false)} className="py-2 text-sm">Donate</Link>
          {user && (
            <>
              <Link to="/dashboard" onClick={() => setOpen(false)} className="py-2 text-sm">Dashboard</Link>
              <Link to="/chat" onClick={() => setOpen(false)} className="py-2 text-sm">Chat</Link>
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
