import { type ZodError } from "zod";

export function formatValidationError(error: ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }

  return {
    error: "Please fix the highlighted fields.",
    fieldErrors,
  };
}
