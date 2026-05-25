import { createFileRoute, Navigate } from "@tanstack/react-router";

// Legacy exam URL — exams are now per-course practice. Redirect to course browse.
export const Route = createFileRoute("/take/$examId")({
  component: () => <Navigate to="/courses" />,
});
