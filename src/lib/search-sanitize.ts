// Sanitize raw user input before embedding into a PostgREST .or() / .ilike() filter string.
// Strips characters that PostgREST treats as filter metacharacters so users can't inject
// extra predicates like `foo,school.eq.X` into the OR expression.
export function sanitizePostgrestTerm(input: string): string {
  return input
    .replace(/[,()*%\\"']/g, " ")
    .replace(/\.(?=[a-zA-Z])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
