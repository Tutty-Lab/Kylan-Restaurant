export const isKylanDebug = import.meta.env.DEV && typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("debug") === "kylan";
