import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Bookmark, Settings as SettingsIcon, Flame, Trophy, Loader2, Share2, Award, Lock } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMyProfile, listMyBookmarks } from "@/lib/account.functions";
import { getMyBadges } from "@/lib/leaderboard.functions";


export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — ReadMe" },
      { name: "description", content: "Your public ReadMe profile — display name, username, and academic details." },
    ],
  }),
  component: ProfilePage,
});

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function ProfilePage() {
  const fetchProfile = useServerFn(getMyProfile);
  const fetchBookmarks = useServerFn(listMyBookmarks);
  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const { data: bookmarks } = useQuery({
    queryKey: ["my-bookmarks"],
    queryFn: () => fetchBookmarks(),
  });

  const copyLink = () => {
    if (!profile?.username) return;
    const url = `${window.location.origin}/u/${profile.username}`;
    navigator.clipboard.writeText(url);
    toast.success("Public profile link copied");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl space-y-8">
        {isLoading || !profile ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row gap-6 items-start">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? "You"} />
                <AvatarFallback className="text-2xl">{initials(profile.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold truncate">{profile.full_name || "Unnamed student"}</h1>
                {profile.username && (
                  <p className="text-muted-foreground text-sm mt-0.5">@{profile.username}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {profile.school && <span className="rounded-full bg-secondary px-2.5 py-1">{profile.school}</span>}
                  {profile.department && <span className="rounded-full bg-secondary px-2.5 py-1">{profile.department}</span>}
                  {profile.level && <span className="rounded-full bg-secondary px-2.5 py-1">Level {profile.level}</span>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/settings">
                    <Button size="sm" variant="outline" className="gap-1.5"><SettingsIcon className="h-4 w-4" /> Edit in Settings</Button>
                  </Link>
                  {profile.username && (
                    <>
                      <Link to="/u/$username" params={{ username: profile.username }}>
                        <Button size="sm" variant="ghost">View public profile</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={copyLink} className="gap-1.5"><Share2 className="h-4 w-4" /> Copy link</Button>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide"><Trophy className="h-3.5 w-3.5" /> XP</div>
                <div className="mt-1 text-2xl font-bold">{profile.xp ?? 0}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide"><Flame className="h-3.5 w-3.5" /> Streak</div>
                <div className="mt-1 text-2xl font-bold">{profile.streak_count ?? 0}<span className="text-sm text-muted-foreground ml-1">days</span></div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide"><Bookmark className="h-3.5 w-3.5" /> Saved</div>
                <div className="mt-1 text-2xl font-bold">{bookmarks?.length ?? 0}</div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Bookmark className="h-5 w-5" /> Saved courses</h2>
              {!bookmarks || bookmarks.length === 0 ? (
                <p className="text-sm text-muted-foreground">You haven't saved any courses yet. Tap the star on any course to save it.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {bookmarks.map((c) => (
                    <Link key={c.id} to="/practice/$courseId" params={{ courseId: c.id }}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-primary transition">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                        <div className="font-medium truncate text-sm">{c.title}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
