import { ZodError, ZodSchema } from "zod";

export default function parseZodSchema<T>(
  data: unknown,
  schema: ZodSchema<T>
): string {
  if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
    return "Please provide the required request body or query parameters.";
  }
  try {
    schema.parse(data);
    return "ok";
  } catch (e) {
    if (e instanceof ZodError) {
      return e.issues.map((issue) => issue.message).join(", ");
    }
    throw e;
  }
}
