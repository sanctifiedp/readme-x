import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, UserPlus, Check, X, UserMinus, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteHeader } from "@/components/SiteHeader";
import {
  searchUsers, listFriends, sendFriendRequest, respondToRequest, removeFriend,
} from "@/lib/friends.functions";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "Friends — ReadMe" }] }),
  component: FriendsPage,
});

function FriendsPage() {
  const fetchList = useServerFn(listFriends);
  const { data, isLoading } = useQuery({ queryKey: ["friends"], queryFn: () => fetchList() });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-bold">Friends</h1>
            <p className="text-sm text-muted-foreground">Find classmates and challenge them to a quiz.</p>
          </div>
        </div>

        <Tabs defaultValue="friends">
          <TabsList>
            <TabsTrigger value="friends">Friends {data && `(${data.friends.length})`}</TabsTrigger>
            <TabsTrigger value="requests">Requests {data && data.incoming.length > 0 && `(${data.incoming.length})`}</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="find">Find people</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-4">
            {isLoading ? <Loader /> : (
              <div className="space-y-2">
                {data?.friends.length === 0 && <Empty msg="No friends yet. Search for people to add." />}
                {data?.friends.map((f) => <FriendRow key={f.id} f={f} kind="accepted" />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            {isLoading ? <Loader /> : (
              <div className="space-y-2">
                {data?.incoming.length === 0 && <Empty msg="No pending requests." />}
                {data?.incoming.map((f) => <FriendRow key={f.id} f={f} kind="incoming" />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent" className="mt-4">
            {isLoading ? <Loader /> : (
              <div className="space-y-2">
                {data?.outgoing.length === 0 && <Empty msg="No outgoing requests." />}
                {data?.outgoing.map((f) => <FriendRow key={f.id} f={f} kind="outgoing" />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="find" className="mt-4">
            <FindPeople />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Loader() {
  return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}

type FriendItem = {
  id: string;
  status: "pending" | "accepted" | "declined";
  direction: string;
  otherUser: { id: string; full_name: string | null; email: string | null; matric_no?: string | null };
};

function FriendRow({ f, kind }: { f: FriendItem; kind: "accepted" | "incoming" | "outgoing" }) {
  const qc = useQueryClient();
  const respondFn = useServerFn(respondToRequest);
  const removeFn = useServerFn(removeFriend);
  const respond = useMutation({
    mutationFn: (action: "accept" | "decline") => respondFn({ data: { friendshipId: f.id, action } }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["friends"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => removeFn({ data: { friendshipId: f.id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["friends"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0">
        <div className="font-medium truncate">{f.otherUser.full_name || "Unnamed"}</div>
        <div className="text-xs text-muted-foreground truncate">{f.otherUser.email}{f.otherUser.matric_no ? ` · ${f.otherUser.matric_no}` : ""}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {kind === "accepted" && (
          <>
            <Link to="/challenges" search={{ opponentId: f.otherUser.id }}>
              <Button size="sm" variant="outline"><Swords className="h-3.5 w-3.5 mr-1" />Challenge</Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
              <UserMinus className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {kind === "incoming" && (
          <>
            <Button size="sm" onClick={() => respond.mutate("accept")} disabled={respond.isPending}>
              <Check className="h-3.5 w-3.5 mr-1" />Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => respond.mutate("decline")} disabled={respond.isPending}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {kind === "outgoing" && (
          <>
            <span className="text-xs text-muted-foreground">Pending</span>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function FindPeople() {
  const qc = useQueryClient();
  const searchFn = useServerFn(searchUsers);
  const sendFn = useServerFn(sendFriendRequest);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const search = useMutation({
    mutationFn: (term: string) => searchFn({ data: { q: term } }),
    onSuccess: (res) => setResults(res.users),
    onError: (e: Error) => toast.error(e.message),
  });
  const send = useMutation({
    mutationFn: (targetUserId: string) => sendFn({ data: { targetUserId } }),
    onSuccess: () => { toast.success("Request sent"); qc.invalidateQueries({ queryKey: ["friends"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) search.mutate(q.trim()); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, or matric no" className="pl-9" />
        </div>
        <Button type="submit" disabled={search.isPending || !q.trim()}>
          {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>
      <div className="space-y-2">
        {results.length === 0 && !search.isPending && <Empty msg="Search for classmates by name, email, or matric number." />}
        {results.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{u.full_name || "Unnamed"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {u.email}{u.matric_no ? ` · ${u.matric_no}` : ""}
                {u.department ? ` · ${u.department}` : ""}{u.level ? ` · ${u.level}` : ""}
              </div>
            </div>
            <Button size="sm" onClick={() => send.mutate(u.id)} disabled={send.isPending}>
              <UserPlus className="h-3.5 w-3.5 mr-1" />Add
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
