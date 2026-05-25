import { Link } from "@tanstack/react-router";
import { MessageCircle, MessageSquareText } from "lucide-react";

const WA_NUMBER = "2349064887865";
const WA_URL = `https://wa.me/${WA_NUMBER}`;
const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdSYgpAaMAFZXmw0HSl38jzQ7DGoogXiR9BVrcCOxDHgyTZ9Q/viewform";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-3">
        <div>
          <h3 className="font-semibold mb-2">ReadMe X</h3>
          <p className="text-sm text-muted-foreground">
            Timed CBT practice from your course's question bank — with AI hints when you're stuck.
            Built by students, for students.
          </p>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Explore</h3>
          <ul className="text-sm space-y-1">
            <li><Link to="/courses" className="hover:text-primary">Browse courses</Link></li>
            <li><Link to="/notes" className="hover:text-primary">Study notes</Link></li>
            <li><Link to="/donate" className="hover:text-primary">Donate</Link></li>
            <li>
              <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="hover:text-primary inline-flex items-center gap-1">
                <MessageSquareText className="h-3.5 w-3.5" /> Give feedback
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Contact admin</h3>
          <a
            href={WA_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm hover:text-primary"
          >
            <MessageCircle className="h-4 w-4" /> Chat on WhatsApp · 0906 488 7865
          </a>
          <p className="text-xs text-muted-foreground mt-2">
            Email: adeyigbeminiyi414@gmail.com
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ReadMe X — Built for students. All rights reserved.
      </div>
    </footer>
  );
}
