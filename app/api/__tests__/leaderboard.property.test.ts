import { describe, it } from "vitest";
import * as fc from "fast-check";
import { z } from "zod";

// Inline the joinSchema for isolated testing (mirrors app/api/leaderboard/join/route.ts)
const joinSchema = z.object({
  userId: z.string().min(1),
  displayName: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[a-zA-Z0-9\s]+$/, "Alphanumeric + spaces only"),
});

// Feature: cartoonistic-app-overhaul, Property 6: Leaderboard join displayName validation
describe("Leaderboard Join Property Tests", () => {
  it("P6: joinSchema accepts displayName iff it matches /^[a-zA-Z0-9\\s]{2,20}$/", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 30 }), (s) => {
        const result = joinSchema.safeParse({ userId: "u1", displayName: s });
        const shouldPass = /^[a-zA-Z0-9\s]{2,20}$/.test(s);
        return result.success === shouldPass;
      }),
      { numRuns: 100 },
    );
  });

  it("valid displayName and userId returns success", () => {
    const result = joinSchema.safeParse({ userId: "user-123", displayName: "Alice" });
    expect(result.success).toBe(true);
  });

  it("displayName too short returns failure", () => {
    const result = joinSchema.safeParse({ userId: "user-123", displayName: "A" });
    expect(result.success).toBe(false);
  });

  it("displayName too long returns failure", () => {
    const result = joinSchema.safeParse({ userId: "user-123", displayName: "A".repeat(21) });
    expect(result.success).toBe(false);
  });

  it("displayName with special chars returns failure", () => {
    const result = joinSchema.safeParse({ userId: "user-123", displayName: "Alice!" });
    expect(result.success).toBe(false);
  });
});
