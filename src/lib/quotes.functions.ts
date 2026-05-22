import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getRandomQuote = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("quotes")
    .select("text, author");
  if (error || !data || data.length === 0) {
    return { text: "Strive for progress, not perfection.", author: "Unknown" };
  }
  const q = data[Math.floor(Math.random() * data.length)];
  return { text: q.text, author: q.author };
});
