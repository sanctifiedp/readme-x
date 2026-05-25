import { createFileRoute, Navigate } from "@tanstack/react-router";

// Exams are now organised as per-course question banks.
export const Route = createFileRoute("/exams")({
  component: () => <Navigate to="/courses" />,
});
