import { z } from "zod";

export const flashcardTypeSchema = z.enum([
  "definition",
  "reasoning",
  "misconception",
  "example",
  "edge",
]);

export const flashcardSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
  type: flashcardTypeSchema.default("definition"),
  difficultyScore: z.number().min(0),
  ease: z.number().min(1.3),
  interval: z.number().min(1),
  repetitions: z.number().min(0),
  dueDate: z.string(),
});

export const generatedFlashcardSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  type: flashcardTypeSchema,
});

export const generatedFlashcardsSchema = z.array(generatedFlashcardSchema);

export type Flashcard = z.infer<typeof flashcardSchema>;
