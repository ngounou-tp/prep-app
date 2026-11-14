// Our own wording for each kind of validation problem, shared by the API and the form, so no
// schema internals ever reach the page.
import type { z } from "zod";

export function fieldMessage(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case "too_big":
      return issue.origin === "array" ? `Add at most ${issue.maximum} people and companies.` : `Keep this under ${issue.maximum} characters.`;
    case "too_small":
      return issue.origin === "array" ? "Add at least one person or company." : "This field is required.";
    case "invalid_format":
      return issue.format === "datetime" ? "Enter a valid meeting date and time." : "Check this field.";
    case "invalid_value":
      return "Choose one of the listed options.";
    case "custom":
      return issue.message;
    default:
      return "Check this field.";
  }
}
