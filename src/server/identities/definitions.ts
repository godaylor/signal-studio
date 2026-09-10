export const ACTIVATION_DEFINITION = Object.freeze({
  key: 'signal-studio.activation.v1',
  label: 'Product activation',
  unit: 'tracked-user',
  exactness: 'exact',
  steps: ['signup', 'onboarding_completed', 'core_feature_used'],
  description:
    'A tracked user is activated after signup, onboarding completion, and first core feature use.',
});

export const ADOPTION_DEFINITION = Object.freeze({
  key: 'signal-studio.adoption.v1',
  label: 'Observed product adoption',
  unit: 'tracked-user',
  exactness: 'exact',
  description:
    'Observed adoption is reported as exact linked sessions and events. It is not a hidden health score.',
});

export const LIFECYCLE_STAGES = Object.freeze({
  identified: 'identified',
  signedUp: 'signed-up',
  onboarding: 'onboarding',
  activated: 'activated',
  retained: 'retained',
  inactive: 'inactive',
});

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[keyof typeof LIFECYCLE_STAGES];

const LIFECYCLE_VALUES = new Set<string>(Object.values(LIFECYCLE_STAGES));

export function isLifecycleStage(value: unknown): value is LifecycleStage {
  return typeof value === 'string' && LIFECYCLE_VALUES.has(value);
}

export function getLifecycleStageFromTraits(traits: Record<string, unknown> | undefined) {
  const value = traits?.lifecycle_stage;

  return isLifecycleStage(value) ? value : LIFECYCLE_STAGES.identified;
}
