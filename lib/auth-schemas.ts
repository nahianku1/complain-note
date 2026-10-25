import { z } from "zod";

export function normalizeBangladeshMobile(value: string) {
  const compact = value.replace(/[\s-]/g, "");
  const normalized = compact.replace(/^\+?880/, "0");
  return /^01[3-9]\d{8}$/.test(normalized) ? normalized : null;
}

const mobileSchema = z
  .string()
  .trim()
  .min(1, "Mobile number is required.")
  .refine((value) => normalizeBangladeshMobile(value) !== null, "Enter a valid Bangladesh mobile number.")
  .transform((value) => normalizeBangladeshMobile(value) as string);

const usernameSchema = z
  .string()
  .trim()
  .min(1, "Username is required.");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.")
  .regex(/[A-Z]/, "Password needs at least one uppercase letter.")
  .regex(/[a-z]/, "Password needs at least one lowercase letter.")
  .regex(/[0-9]/, "Password needs at least one number.")
  .regex(/[^A-Za-z0-9]/, "Password needs at least one special character.");

export const signupSchema = z
  .object({
    username: usernameSchema,
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    mobile: mobileSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .superRefine((values, context) => {
    if (values.password !== values.confirmPassword) {
      context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
    }
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Username, email, or mobile number is required."),
  password: z.string().min(1, "Password is required."),
});

export const profileSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  mobile: mobileSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .superRefine((values, context) => {
    if (values.password !== values.confirmPassword) {
      context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
    }
  });

export type SignupInput = z.input<typeof signupSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
