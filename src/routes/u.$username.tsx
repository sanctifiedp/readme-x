import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Flame, Trophy, Loader2, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPublicProfileByUsername } from "@/lib/account.functions";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — ReadMe` },
      { name: "description", content: `Public ReadMe profile for @${params.username}.` },
      { property: "og:title", content: `@${params.username} on ReadMe` },
      { property: "og:description", content: `See @${params.username}'s ReadMe profile — XP, streak, school and level.` },
    ],
  }),
  component: PublicProfilePage,
  notFoundComponent: NotFound,
});

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold">User not found</h1>
        <p className="text-muted-foreground text-sm">That username doesn't exist on ReadMe.</p>
        <Link to="/"><Button variant="outline" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back home</Button></Link>
      </main>
      <SiteFooter />
    </div>
  );
}

function PublicProfilePage() {
  const { username } = Route.useParams();
  const fetchProfile = useServerFn(getPublicProfileByUsername);
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => fetchProfile({ data: { username } }),
    retry: false,
  });

  if (isError) throw notFound();

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
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? profile.username ?? "User"} />
                <AvatarFallback className="text-2xl">{initials(profile.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold truncate">{profile.full_name || `@${profile.username}`}</h1>
                {profile.username && (
                  <p className="text-muted-foreground text-sm mt-0.5">@{profile.username}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {profile.school && <span className="rounded-full bg-secondary px-2.5 py-1">{profile.school}</span>}
                  {profile.department && <span className="rounded-full bg-secondary px-2.5 py-1">{profile.department}</span>}
                  {profile.level && <span className="rounded-full bg-secondary px-2.5 py-1">Level {profile.level}</span>}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide"><Trophy className="h-3.5 w-3.5" /> XP</div>
                <div className="mt-1 text-2xl font-bold">{profile.xp ?? 0}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide"><Flame className="h-3.5 w-3.5" /> Streak</div>
                <div className="mt-1 text-2xl font-bold">{profile.streak_count ?? 0}<span className="text-sm text-muted-foreground ml-1">days</span></div>
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
