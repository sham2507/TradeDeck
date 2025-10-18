import { z } from "zod";

export const createInstanceBody = z
  .object({
    indexName: z.string({
      required_error: "The 'entrySide' field is required.",
      invalid_type_error: "The 'entrySide' field must be a string.",
    }),

    expiry: z.string({
      required_error: "The 'entrySide' field is required.",
      invalid_type_error: "The 'entrySide' field must be a string.",
    }),

    ltpRange: z.number({
      required_error: "The 'ltpRange' field is required.",
      invalid_type_error: "The 'ltpRange' field must be a number.",
    }),
  })
  .strict();

export const deleteInstanceQuery = z
  .object({
    id: z.string({
      required_error: "The 'id' field is required.",
      invalid_type_error: "The 'id' field must be a string.",
    }),
  })
  .strict();
