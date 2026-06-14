/** Provider onboarding stages (1–8). */
export const ONBOARDING_STAGES = {
  1: "application",
  2: "credentials",
  3: "background",
  4: "contract",
  5: "baa",
  6: "stripe",
  7: "availability",
  8: "complete",
} as const;

export type OnboardingStage = keyof typeof ONBOARDING_STAGES;

export const STAGE_MESSAGES: Record<number, string> = {
  1: "Thanks for starting your PsychRx provider application! Next up: submit your credentials.",
  2: "Credentials received. We'll review your background info next.",
  3: "Background check step complete. Watch your email for the Independent Contractor Agreement.",
  4: "Your contract has been sent — please sign when you're ready.",
  5: "BAA sent. Almost there — payment setup is next.",
  6: "Stripe Connect link sent. Set up payouts, then add your availability.",
  7: "Availability saved. Final review and you're ready to see patients!",
  8: "Welcome to PsychRx — your onboarding is complete and you're active!",
};
