import { z } from "zod";

export const createTradeInfoBody = z
  .object({
    pointOfAdjustment: z
      .number({
        required_error: "The 'pointOfAdjustment' field is required.",
        invalid_type_error: "The 'pointOfAdjustment' field must be a number.",
      })
      .refine((val) => Number.isInteger(val), {
        message: "The 'pointOfAdjustment' field must be an integer.",
      }),
    instanceId: z.string({
      required_error: "The 'instanceId' field is required.",
      invalid_type_error: "The 'instanceId' field must be a string.",
    }),
    legCount: z.number({
      required_error: "The 'legCount' field is required.",
      invalid_type_error: "The 'legCount' field must be a number.",
    }),
  })
  .strict();

export const updateTradeInfoBody = z
  .object({
    entrySide: z
      .string({
        required_error: "The 'entrySide' field is required.",
        invalid_type_error: "The 'entrySide' field must be a string.",
      })
      .optional(),
    qty: z
      .number({
        invalid_type_error: "The 'qty' field must be a number.",
      })
      .refine((val) => Number.isInteger(val), {
        message: "The 'qty' field must be an integer.",
      })
      .optional(),

    currentQty: z
      .number({
        invalid_type_error: "The 'qty' field must be a number.",
      })
      .refine((val) => Number.isInteger(val), {
        message: "The 'qty' field must be an integer.",
      })
      .optional(),

    entryType: z
      .enum(["LIMIT", "MARKET", "UNDEFINED"], {
        errorMap: () => ({
          message:
            "The 'entryType' field must be one of: LIMIT, MARKET, or UNDEFINED.",
        }),
      })
      .optional(),

    entryPrice: z
      .number({
        invalid_type_error: "The 'entry price' field must be a number.",
      })

      .optional(),

    stopLossPremium: z
      .number({
        invalid_type_error: "The 'Stop Loss' field must be a number.",
      })

      .optional(),

    takeProfitPremium: z
      .number({
        invalid_type_error: "The 'Take Profit' field must be a number.",
      })

      .optional(),

    stopLossPoints: z
      .number({
        invalid_type_error: "The 'Stop Loss Points' field must be a number.",
      })
      .optional(),

    takeProfitPoints: z
      .number({
        invalid_type_error: "The 'Take Profit Points' field must be a number.",
      })
      .optional(),

    entrySpotPrice: z
      .number({
        invalid_type_error: "The 'entrySpotPrice' field must be a number.",
      })

      .optional(),

    LastPointOfAdjustment: z
      .number({
        invalid_type_error:
          "The 'lastPointOfAdjustment' field must be a number.",
      })
      .refine((val) => Number.isInteger(val), {
        message: "The 'lastPointOfAdjustment' field must be an integer.",
      })
      .optional(),

    pointOfAdjustment: z
      .number({
        invalid_type_error: "The 'pointOfAdjustment' field must be a number.",
      })
      .refine((val) => Number.isInteger(val), {
        message: "The 'pointOfAdjustment' field must be an integer.",
      })
      .optional(),

    pointOfAdjustmentUpperLimit: z
      .number({
        invalid_type_error:
          "The 'pointOfAdjustmentUpperLimit' field must be a number.",
      })
      .refine((val) => Number.isInteger(val), {
        message: "The 'pointOfAdjustmentUpperLimit' field must be an integer.",
      })
      .optional(),

    pointOfAdjustmentLowerLimit: z
      .number({
        invalid_type_error:
          "The 'pointOfAdjustmentLowerLimit' field must be a number.",
      })
      .refine((val) => Number.isInteger(val), {
        message: "The 'pointOfAdjustmentLowerLimit' field must be an integer.",
      })
      .optional(),

    entryTriggered: z
      .boolean({
        invalid_type_error: "The 'entryTriggered' field must be a boolean.",
      })
      .optional(),
    slTriggered: z
      .boolean({
        invalid_type_error: "The 'slTriggered' field must be a boolean",
      })
      .optional(),
    tpTriggered: z
      .boolean({
        invalid_type_error: "The 'tpTriggered' field must be a boolean",
      })
      .optional(),
    alive: z
      .boolean({ invalid_type_error: "The 'alive' field must be a boolean" })
      .optional(),
    userExit: z
      .number({ invalid_type_error: "The 'userExit' field must be a Number" })
      .optional(),

    reason: z
      .string({ invalid_type_error: "The 'reason' field must be a string" })
      .optional(),
  })
  .strict();
