import { useEffect, useState } from "preact/hooks";
import type { LocationState } from "./types";

export function useLocationState(): LocationState {
  const [state, setState] = useState<LocationState>(() => readLocation());
  useEffect(() => {
    const update = () => setState(readLocation());
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (anchor?.origin === window.location.origin) {
        setTimeout(update, 0);
      }
    };
    window.addEventListener("popstate", update);
    window.addEventListener("lakebed:locationchange", update);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("lakebed:locationchange", update);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return state;
}

export function readLocation(): LocationState {
  if (typeof window === "undefined") {
    return { path: "/", query: new URLSearchParams() };
  }
  return {
    path: window.location.pathname.replace(/\/+$/, "") || "/",
    query: new URLSearchParams(window.location.search),
  };
}

export function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.dispatchEvent(new Event("lakebed:locationchange"));
}

export function safeReturnPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/owner";
}
