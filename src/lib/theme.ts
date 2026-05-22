export function initTheme() {
  if (typeof window === "undefined") return;
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = saved ? saved === "dark" : prefersDark;
  document.documentElement.classList.toggle("dark", dark);
}

export function toggleTheme() {
  if (typeof window === "undefined") return;
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

export function isDark() {
  if (typeof window === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}
