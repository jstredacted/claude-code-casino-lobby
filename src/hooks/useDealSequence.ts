import { useState, useEffect, useCallback } from "react";

/**
 * Step-based timer that auto-advances from step 1 to maxStep.
 * Each card gets 2 steps: appear face-down (odd), flip face-up (even).
 * Call start() to begin, reset() to clear.
 */
export function useDealSequence(maxStep: number, delayMs = 250) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step > 0 && step < maxStep) {
      const isFlip = step % 2 === 0;
      const delay = isFlip ? delayMs : Math.floor(delayMs * 0.5);
      const timer = setTimeout(() => setStep((s) => s + 1), delay);
      return () => clearTimeout(timer);
    }
  }, [step, maxStep, delayMs]);

  const start = useCallback(() => setStep(1), []);
  const reset = useCallback(() => setStep(0), []);

  return { step, start, reset, isDone: step >= maxStep };
}
