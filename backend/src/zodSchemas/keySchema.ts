import { z } from "zod";

export const updateKeyBody = z
  .object({
    apiKey: z
      .string({
        invalid_type_error: "The 'apiKey' field must be a string.",
      })
      .optional(),
    apiSecret: z
      .string({
        invalid_type_error: "The 'apiSecret' field must be a string.",
      })
      .optional(),
  })
  .strict();
