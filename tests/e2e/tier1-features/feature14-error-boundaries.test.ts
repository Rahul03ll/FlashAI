import { describe, it, expect, beforeEach } from "vitest";
import { FlashAiApiSimulator } from "../harness/api-simulator";

// Synthetic error boundary simulator for UI component crashes
class ErrorBoundaryHarness {
  hasError = false;
  caughtError: Error | null = null;

  render(componentFn: () => string): { output: string; fallbackRendered: boolean } {
    try {
      if (this.hasError) {
        return { output: "Something went wrong. Please try refreshing.", fallbackRendered: true };
      }
      const output = componentFn();
      return { output, fallbackRendered: false };
    } catch (err) {
      this.hasError = true;
      this.caughtError = err instanceof Error ? err : new Error(String(err));
      return { output: "Something went wrong. Please try refreshing.", fallbackRendered: true };
    }
  }

  reset() {
    this.hasError = false;
    this.caughtError = null;
  }
}

describe("Tier 1: Feature 14 - Error Boundaries & Resilience (R4)", () => {
  let api: FlashAiApiSimulator;
  let boundary: ErrorBoundaryHarness;

  beforeEach(() => {
    api = new FlashAiApiSimulator();
    boundary = new ErrorBoundaryHarness();
  });

  it("14.1 catches runtime component rendering error and renders fallback UI", () => {
    const brokenComponent = () => {
      throw new Error("Render exploded: Cannot read properties of undefined");
    };

    const result = boundary.render(brokenComponent);
    expect(result.fallbackRendered).toBe(true);
    expect(result.output).toContain("Something went wrong");
    expect(boundary.hasError).toBe(true);
  });

  it("14.2 API routes return structured JSON error with status 400 on malformed input", () => {
    const res = api.bootstrapUser("");
    expect(res.status).toBe(400);
    expect(res.data.error).toBeDefined();
    expect(typeof res.data.error).toBe("string");
  });

  it("14.3 rejects missing required parameters with clear validation messages", () => {
    const res = api.verifyOtpCode("", "");
    expect(res.status).toBe(400);
    expect(res.data.error).toContain("required");
  });

  it("14.4 study review returns 404 cleanly when card does not exist without server crash", () => {
    const res = api.reviewCard("non-existent-card", "user-1", { quality: "good" });
    expect(res.status).toBe(404);
    expect(res.data.error).toContain("Card not found");
  });

  it("14.5 error boundary supports reset and recovery after component crash", () => {
    let shouldCrash = true;
    const flappyComponent = () => {
      if (shouldCrash) throw new Error("Temporary crash");
      return "Study Room Active";
    };

    // First render fails
    const failResult = boundary.render(flappyComponent);
    expect(failResult.fallbackRendered).toBe(true);

    // Reset error state and re-render
    boundary.reset();
    shouldCrash = false;
    const okResult = boundary.render(flappyComponent);
    expect(okResult.fallbackRendered).toBe(false);
    expect(okResult.output).toBe("Study Room Active");
  });
});
