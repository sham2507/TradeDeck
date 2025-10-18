import { z } from "zod";

const addUserBody = z
  .object({
    credentials: z.string({
      required_error: "The 'credentials' field is required.",
      invalid_type_error: "The 'credentials' field must be a string.",
    }),

    password: z
      .string({
        required_error: "The 'password' field is required.",
        invalid_type_error: "The 'password' field must be a string.",
      })
      .min(8, {
        message: "The 'password' must be at least 8 characters long.",
      }),

    reset: z.boolean({
      required_error: "The 'reset' field is required.",
      invalid_type_error: "The 'reset' field must be a boolean.",
    }),
  })
  .strict();

const userLoginBody = z
  .object({
    password: z
      .string({
        required_error: "The 'password' field is required.",
        invalid_type_error: "The 'password' field must be a string.",
      })
      .min(8, {
        message: "The 'password' must be at least 8 characters long.",
      }),

    otp: z
      .number({
        invalid_type_error: "The 'otp' field must be a number.",
      })
      .int()
      .gte(100000, { message: "The 'otp' must be a 6-digit number." })
      .lte(999999, { message: "The 'otp' must be a 6-digit number." })
      .optional(),
  })
  .strict();

const updateCredentialsBody = z
  .object({
    oldPassword: z
      .string({
        required_error: "The 'Old password' field is required.",
        invalid_type_error: "The 'Old password' field must be a string.",
      })
      .min(8, {
        message: "The 'password' must be at least 8 characters long.",
      }),
    newPassword: z
      .string({
        required_error: "The 'New password' field is required.",
        invalid_type_error: "The 'New password' field must be a string.",
      })
      .min(8, {
        message: "The 'password' must be at least 8 characters long.",
      }),
  })
  .strict();

const createTOtpBody = z
  .object({
    credential: z.string({
      required_error: "The 'credential field is required.",
      invalid_type_error: "The 'credential' field must be a string.",
    }),

    otp: z
      .number({
        invalid_type_error: "The 'otp' field must be a number.",
      })
      .int()
      .gte(100000, { message: "The 'otp' must be a 6-digit number." })
      .lte(999999, { message: "The 'otp' must be a 6-digit number." }),
  })
  .strict();

export { addUserBody, userLoginBody, updateCredentialsBody, createTOtpBody };
