import { z } from "zod";

export const IdeaInputSchema = z.strictObject({
  kind: z.enum(["idea", "problem"]),
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().min(10).max(2_000),
  problem: z.string().trim().max(5_000).optional(),
  solution: z.string().trim().max(5_000).optional(),
  benefits: z.string().trim().max(5_000).optional(),
  risks: z.string().trim().max(5_000).optional(),
  category: z.string().trim().min(1).max(120),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
});

export type IdeaInput = z.infer<typeof IdeaInputSchema>;
