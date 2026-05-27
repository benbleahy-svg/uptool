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
