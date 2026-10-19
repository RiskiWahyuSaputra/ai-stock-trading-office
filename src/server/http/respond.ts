import "server-only";
import { z } from "zod";
import { SymbolNotFoundError } from "@/server/providers";

/** Uniform JSON error responses for route handlers. */
export function errorResponse(err: unknown) {
  if (err instanceof z.ZodError) {
    return Response.json({ error: "Parameter tidak valid.", issues: err.issues }, { status: 400 });
  }
  if (err instanceof SymbolNotFoundError) {
    return Response.json({ error: err.message }, { status: 404 });
  }
  console.error(err);
  return Response.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
}

export function searchParams(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams);
}
