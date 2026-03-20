/** Maps HTTP methods and status codes to CSS color variables. */

export function methodColor(method: string, statusCode: number): string {
  if (statusCode >= 400) return "var(--red)";
  switch (method) {
    case "GET": return "var(--green)";
    case "POST": return "var(--blue)";
    case "PUT": case "PATCH": return "var(--amber)";
    case "DELETE": return "var(--red)";
    default: return "var(--text-muted)";
  }
}

export function subEventColor(type: "query" | "fetch"): string {
  return type === "query" ? "var(--accent)" : "var(--cyan)";
}
