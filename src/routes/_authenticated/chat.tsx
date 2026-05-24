import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { getChatProfileNames } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [{ title: "Class chat — ReadMe" }, { name: "description", content: "Realtime group chat with your classmates." }],
  }),
  component: ChatPage,
});


type Msg = { id: string; body: string; user_id: string; created_at: string; full_name?: string | null };

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const profilesCache = useRef<Map<string, string>>(new Map());
  const endRef = useRef<HTMLDivElement>(null);
  const fetchNames = useServerFn(getChatProfileNames);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));



    (async () => {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, body, user_id, created_at")
        .order("created_at", { ascending: true })
        .limit(200);
      const userIds = [...new Set((msgs ?? []).map((m) => m.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        profs?.forEach((p) => profilesCache.current.set(p.id, p.full_name ?? "Student"));
      }
      setMessages(
        (msgs ?? []).map((m) => ({ ...m, full_name: profilesCache.current.get(m.user_id) ?? "Student" })),
      );
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    })();

    const channel = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const m = payload.new as Msg;
          let name = profilesCache.current.get(m.user_id);
          if (!name) {
            const { data: p } = await supabase.from("profiles").select("full_name").eq("id", m.user_id).single();
            name = p?.full_name ?? "Student";
            profilesCache.current.set(m.user_id, name);
          }
          setMessages((arr) => [...arr, { ...m, full_name: name }]);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !me) return;
    setSending(true);
    const body = text.trim().slice(0, 2000);
    setText("");
    const { error } = await supabase.from("chat_messages").insert({ user_id: me, body });
    setSending(false);
    if (error) {
      toast.error(error.message);
      setText(body);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Class chat</h1>
          <p className="text-sm text-muted-foreground">Be kind. Be helpful. No spam.</p>
        </div>

        <div className="flex-1 rounded-2xl border border-border bg-card overflow-hidden flex flex-col min-h-[60vh]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading messages…
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">No messages yet. Be the first to say hi 👋</div>
            ) : (
              messages.map((m) => {
                const mine = m.user_id === me;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}>
                      {!mine && (
                        <div className="text-xs font-semibold mb-0.5 opacity-80">{m.full_name}</div>
                      )}
                      <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                      <div className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
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
              placeholder="Type a message…"
              maxLength={2000}
              disabled={sending}
            />
            <Button type="submit" disabled={!text.trim() || sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
