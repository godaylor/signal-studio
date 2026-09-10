import prisma from '@/lib/prisma';
import { parseRequest } from '@/lib/request';
import { badRequest, json, notFound, serviceUnavailable } from '@/lib/response';
import {
  encryptSecret,
  getTwoFactorConfigurationError,
  isTwoFactorConfigured,
} from '@/lib/two-factor/crypto';
import {
  generateOtpAuthUri,
  generateQrCodeDataUrl,
  generateTotpSecret,
} from '@/lib/two-factor/totp';
import { getUser } from '@/queries/prisma/user';
import { recordSecurityAuditEvent } from '@/server/auth/audit';

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  // Secrets cannot be stored without an encryption key
  if (!isTwoFactorConfigured()) {
    await recordSecurityAuditEvent({
      actorUserId: auth.user.id,
      eventType: 'auth.two_factor.setup.initiate',
      outcome: 'blocked',
      metadata: { reason: 'two_factor_not_configured' },
    });
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  const userId = auth.user.id;
  const user = await getUser(userId);

  if (!user) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.setup.initiate',
      outcome: 'failure',
      metadata: { reason: 'user_not_found' },
    });
    return badRequest({ message: 'User not found' });
  }

  const existing = await prisma.client.twoFactorAuth.findUnique({ where: { userId } });

  if (existing?.isEnabled) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.setup.initiate',
      outcome: 'failure',
      metadata: { reason: 'already_enabled' },
    });
    return badRequest({
      code: 'two-factor-error-already-enabled',
      message: '2FA is already enabled',
    });
  }

  const secret = generateTotpSecret();
  const encryptedSecret = encryptSecret(secret);
  const otpAuthUri = generateOtpAuthUri(secret, user.username);
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpAuthUri);

  await prisma.client.twoFactorAuth.upsert({
    where: { userId },
    update: { secret: encryptedSecret, isEnabled: false },
    create: { userId, secret: encryptedSecret, isEnabled: false },
  });

  await recordSecurityAuditEvent({
    actorUserId: userId,
    eventType: 'auth.two_factor.setup.initiate',
    outcome: 'success',
  });

  /*
  `manualKey` is intentionally plaintext as the user needs it once for manual entry.
  The encrypted copy in DB is what matters for long-term storage.
   */
  return json({ qrCodeDataUrl, manualKey: secret });
}
