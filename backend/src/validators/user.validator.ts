import { z } from "zod";
 
// NEW — update profile validator
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  bio: z.string().trim().max(150).optional(),
  avatar: z.string().optional(), // base64 image string
});
 
export type UpdateProfileSchemaType = z.infer<typeof updateProfileSchema>;
 