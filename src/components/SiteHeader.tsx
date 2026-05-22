import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Moon, Sun, LogOut, Heart, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { initTheme, toggleTheme, isDark } from "@/lib/theme";

export function SiteHeader() {
  const [user, setUser] = useState<{ email?: string | null } | null>(null);
  const [dark, setDark] = useState(false);
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
          <Link to="/" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            Home
          </Link>
          {user && (
            <>
              <Link to="/dashboard" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link to="/chat" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Class chat
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <a href="#donate" className="hidden sm:inline-flex">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Heart className="h-4 w-4" /> Donate
            </Button>
          </a>
          <a href="sms:09064887865" className="hidden sm:inline-flex">
            <Button variant="default" size="sm" className="gap-1.5">
              <Phone className="h-4 w-4" /> 09064887865
            </Button>
          </a>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              toggleTheme();
              setDark(isDark());
            }}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          ) : (
            <Link to="/auth">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
