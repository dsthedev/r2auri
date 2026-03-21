import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DARK_CLASS = "dark"

export function toggleDarkMode() {
  if (typeof document === "undefined") return false
  return document.documentElement.classList.toggle(DARK_CLASS)
}

export function setupDarkModeHotkey(onToggle: () => void = toggleDarkMode) {
  if (typeof window === "undefined") return () => {}

  const handler = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat) return
    if (event.metaKey || event.ctrlKey || event.altKey) return

    const target = event.target as HTMLElement | null
    if (target) {
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return
    }

    if (event.key.toLowerCase() === "d") {
      event.preventDefault()
      onToggle()
    }
  }

  window.addEventListener("keydown", handler)
  return () => window.removeEventListener("keydown", handler)
}
