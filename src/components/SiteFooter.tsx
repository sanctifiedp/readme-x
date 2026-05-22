export function SiteFooter() {
  return (
    <footer id="donate" className="border-t border-border/60 bg-muted/30">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-3">
        <div>
          <h3 className="font-semibold mb-2">ReadMe</h3>
          <p className="text-sm text-muted-foreground">
            A computer-based testing platform built for students. Take exams, get auto-graded instantly,
            chat with classmates, and stay inspired.
          </p>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Support the project</h3>
          <p className="text-sm text-muted-foreground">
            Donations help keep ReadMe running.
          </p>
          <ul className="mt-2 text-sm space-y-1">
            <li><span className="text-muted-foreground">Name:</span> Adeyi Gbeminiyi</li>
            <li><span className="text-muted-foreground">Bank:</span> Opay</li>
            <li><span className="text-muted-foreground">Account:</span> 9064887865</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Contact admin</h3>
          <ul className="text-sm space-y-1">
            <li>
              <a className="hover:text-primary" href="tel:09064887865">09064887865</a>
            </li>
            <li>
              <a className="hover:text-primary" href="mailto:adeyigbeminiyi414@gmail.com">
                adeyigbeminiyi414@gmail.com
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ReadMe — CBT Exam Platform. All rights reserved.
      </div>
    </footer>
  );
}
