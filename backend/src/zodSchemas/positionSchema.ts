import { z } from "zod";

const updateLiveTradePositionObject = z
  .object({
    id: z.string({ required_error: "id is required" }),
    data: z.object({
      currentQty: z
        .string({
          invalid_type_error: "The 'currentQty' field must be a String.",
        })
        .optional(),
      closed: z
        .boolean({
          invalid_type_error: "The 'closed' field must be a Boolean.",
        })
        .optional(),
    }),
  })
  .strict();

const liveTradePositionObjectSchema = z
  .object({
    optionName: z.string({
      required_error: "optionName is required",
    }),
    initialQty: z.string({
      required_error: "qty is required",
    }),
    currentQty: z.string({
      required_error: "qty is required",
    }),
    entryPrice: z.number({
      required_error: "entryPrice is required",
    }),
    tradeDetailsId: z.string({
      required_error: "tradeDetailsId is required",
    }),
    exchangeId: z.string({
      required_error: "exchangeId is required",
    }),
    entryAppOrderId: z.number({
      required_error: "entry appOrderId is required",
    }),
    exitAppOrderId: z.number({
      required_error: "exit appOrderId is required",
    }),
    closed: z.boolean().optional(),
    closePrice: z.number().optional(),
  })
  .strict();

export const liveTradePositionsBody = z
  .object({
    positions: z
      .array(liveTradePositionObjectSchema)
      .min(1, "At least one position is required"),
  })
  .strict();

export const updateLiveTradePositionBody = z
  .object({
    tradeDetailsId: z.string({ required_error: "id is required" }),
    data: z.object({
      currentQty: z
        .string({
          invalid_type_error: "The 'currentQty' field must be a String.",
        })
        .optional(),
      closed: z
        .boolean({
          invalid_type_error: "The 'closed' field must be a Boolean.",
        })
        .optional(),
    }),
  })
  .strict();

export const updateLiveTradePositionBulkBody = z
  .object({
    positions: z
      .array(updateLiveTradePositionObject)
      .min(1, "At Least one Position is required"),
  })
  .strict();
