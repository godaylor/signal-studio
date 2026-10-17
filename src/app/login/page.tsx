import type { Metadata } from 'next';
import { LoginPage } from './LoginPage';
import { GUEST_DATASET } from '@/server/guest/dataset';

export const dynamic = 'force-dynamic';

export default async function () {
  if (process.env.DISABLE_LOGIN || process.env.CLOUD_MODE) {
    return null;
  }

  return (
    <LoginPage
      sample={{
        users: GUEST_DATASET.users,
        onboarding: GUEST_DATASET.onboarding,
        activatedUsers: GUEST_DATASET.activatedUsers,
        subscriptions: GUEST_DATASET.subscriptions,
      }}
    />
  );
}

export const metadata: Metadata = {
  title: 'Login',
};
