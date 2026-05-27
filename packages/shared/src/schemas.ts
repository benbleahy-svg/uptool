import { z } from "zod";

export const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
  country: z.enum(["DE", "AT", "CH"]),
  locale: z.enum(["de", "en-GB"]),
});

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;

export const UpdateLocaleSchema = z.object({
  locale: z.enum(["de", "en-GB"]),
});

export type UpdateLocaleInput = z.infer<typeof UpdateLocaleSchema>;

export const UpdateGeneralSettingsSchema = z.object({
  name: z.string().min(1).max(100),
  vatId: z.string().max(50).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  street: z.string().max(200).optional().nullable(),
  postal: z.string().max(20).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.enum(["DE", "AT", "CH"]),
  defaultHourlyRateCents: z.number().int().min(0),
});

export type UpdateGeneralSettingsInput = z.infer<typeof UpdateGeneralSettingsSchema>;
