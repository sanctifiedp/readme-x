import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Trash2, Hash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { getChatProfileNames, getMyRoles } from "@/lib/admin.functions";
import { listRooms, adminDeleteMessage } from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [{ title: "Class chat — ReadMe" }, { name: "description", content: "Realtime group chat with your classmates." }],
  }),
  component: ChatPage,
});

type Msg = { id: string; body: string; user_id: string; created_at: string; room_id: string; full_name?: string | null };
type Room = { id: string; name: string; description: string | null; is_archived: boolean; created_at: string };

function ChatPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const profilesCache = useRef<Map<string, string>>(new Map());
  const endRef = useRef<HTMLDivElement>(null);
  const fetchNames = useServerFn(getChatProfileNames);
  const fetchRooms = useServerFn(listRooms);
  const fetchRoles = useServerFn(getMyRoles);
  const deleteMsgFn = useServerFn(adminDeleteMessage);

  // Bootstrap: user, roles, rooms
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMe(u.user?.id ?? null);
      try {
        const r = await fetchRoles();
        setIsAdmin(r.isAdmin);
      } catch { /* ignore */ }
      try {
        const list = await fetchRooms();
        const active = list.filter((r) => !r.is_archived);
        setRooms(active);
        if (active.length > 0) setActiveRoom(active[0].id);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
  }, []);

  // Load messages + subscribe to changes for active room
  useEffect(() => {
    if (!activeRoom) return;
    let cancelled = false;
    setLoading(true);
    setMessages([]);

    (async () => {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, body, user_id, created_at, room_id")
        .eq("room_id", activeRoom)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      const userIds = [...new Set((msgs ?? []).map((m) => m.user_id))].filter(
        (id) => !profilesCache.current.has(id),
      );
      if (userIds.length > 0) {
        try {
          const profs = await fetchNames({ data: { userIds } });
          profs.forEach((p) => profilesCache.current.set(p.id, p.full_name ?? "Student"));
        } catch { /* ignore */ }
      }
      setMessages(
        (msgs ?? []).map((m) => ({ ...m, full_name: profilesCache.current.get(m.user_id) ?? "Student" })),
      );
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    })();

    const channel = supabase
      .channel(`chat-room-${activeRoom}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${activeRoom}` },
        async (payload) => {
          const m = payload.new as Msg;
          let name = profilesCache.current.get(m.user_id);
          if (!name) {
            try {
              const profs = await fetchNames({ data: { userIds: [m.user_id] } });
              name = profs[0]?.full_name ?? "Student";
            } catch {
              name = "Student";
            }
            profilesCache.current.set(m.user_id, name);
          }
          setMessages((arr) => [...arr, { ...m, full_name: name }]);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages", filter: `room_id=eq.${activeRoom}` },
        (payload) => {
          const old = payload.old as { id: string };
          setMessages((arr) => arr.filter((m) => m.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeRoom]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !me || !activeRoom) return;
    setSending(true);
    const body = text.trim().slice(0, 2000);
    setText("");
    const { error } = await supabase.from("chat_messages").insert({ user_id: me, body, room_id: activeRoom });
    setSending(false);
    if (error) {
      toast.error(error.message);
      setText(body);
    }
  };

  const deleteMessage = async (m: Msg) => {
    if (!confirm("Delete this message?")) return;
    try {
      if (m.user_id === me) {
        const { error } = await supabase.from("chat_messages").delete().eq("id", m.id);
        if (error) throw error;
      } else if (isAdmin) {
        await deleteMsgFn({ data: { id: m.id } });
      } else {
        return;
      }
      setMessages((arr) => arr.filter((x) => x.id !== m.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const activeRoomMeta = rooms.find((r) => r.id === activeRoom);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-5xl flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Class chat</h1>
          <p className="text-sm text-muted-foreground">Be kind. Be helpful. No spam.</p>
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-4 flex-1 min-h-[60vh]">
          {/* Rooms sidebar */}
          <aside className="rounded-2xl border border-border bg-card p-2 h-fit md:h-auto md:max-h-[70vh] overflow-y-auto">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">Rooms</div>
            {rooms.length === 0 ? (
              <div className="text-xs text-muted-foreground px-2 py-3">No rooms yet.</div>
            ) : (
              <ul className="space-y-0.5">
                {rooms.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setActiveRoom(r.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${
                        r.id === activeRoom ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <Hash className="h-3.5 w-3.5 opacity-70" />
                      <span className="truncate">{r.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Messages */}
          <div className="flex-1 rounded-2xl border border-border bg-card overflow-hidden flex flex-col min-h-[60vh]">
            {activeRoomMeta && (
              <div className="border-b border-border px-4 py-2.5">
                <div className="font-semibold flex items-center gap-1.5"><Hash className="h-4 w-4" /> {activeRoomMeta.name}</div>
                {activeRoomMeta.description && <div className="text-xs text-muted-foreground">{activeRoomMeta.description}</div>}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading messages…
                </div>
              ) : !activeRoom ? (
                <div className="text-center text-muted-foreground py-12">Pick a room to start chatting.</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">No messages yet. Be the first to say hi 👋</div>
              ) : (
                messages.map((m) => {
                  const mine = m.user_id === me;
                  const canDelete = mine || isAdmin;
                  return (
                    <div key={m.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`relative max-w-[75%] rounded-2xl px-4 py-2 ${
                        mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}>
                        {!mine && (
                          <div className="text-xs font-semibold mb-0.5 opacity-80">{m.full_name}</div>
                        )}
                        <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {canDelete && (
                          <button
                            onClick={() => deleteMessage(m)}
                            className={`absolute -top-2 ${mine ? "-left-2" : "-right-2"} opacity-0 group-hover:opacity-100 transition rounded-full bg-background border border-border p-1 shadow-sm`}
                            aria-label="Delete message"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="border-t border-border p-3 flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={activeRoom ? "Type a message…" : "Select a room first"}
                maxLength={2000}
                disabled={sending || !activeRoom}
              />
              <Button type="submit" disabled={!text.trim() || sending || !activeRoom}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
