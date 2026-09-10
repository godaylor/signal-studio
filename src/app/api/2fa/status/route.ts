import { parseRequest } from '@/lib/request';
import { json } from '@/lib/response';
import { isTwoFactorConfigured } from '@/lib/two-factor/crypto';
import { getTwoFactorPolicy } from '@/server/auth/two-factor-policy';

export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  if (process.env.CLOUD_MODE) {
    return json({
      isEnabled: false,
      isRequired: false,
      requiredReason: null,
      isConfigured: false,
      globalRequired: false,
    });
  }

  const policy = await getTwoFactorPolicy(auth.user.id, auth.user.twoFactorRequired);

  return json({
    isEnabled: policy.enabled,
    isRequired: policy.required,
    requiredReason: policy.requiredReason,
    isConfigured: isTwoFactorConfigured(),
    globalRequired: policy.requiredReason === 'global',
  });
}
