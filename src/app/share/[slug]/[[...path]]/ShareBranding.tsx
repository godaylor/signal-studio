'use client';
import { Row, Text } from '@umami/react-zen';
import { useShare } from '@/components/hooks';

const LOGO_SIZE = { sm: 24, md: 32, lg: 40 };
const TEXT_SIZE = { sm: 'sm', md: 'base', lg: 'lg' } as const;

export function ShareBranding({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const share = useShare();
  const logoDomain = share?.whiteLabel?.domainName || '/';
  const logoName = share?.whiteLabel?.displayName || 'Signal Studio';
  const logoImage = share?.whiteLabel?.logoUrl;
  const height = LOGO_SIZE[size];

  return (
    <a href={logoDomain} target="_blank" rel="noopener" style={{ marginLeft: 12 }}>
      <Row alignItems="center" gap>
        {logoImage ? <img src={logoImage} alt={logoName} style={{ height }} /> : null}
        <Text size={TEXT_SIZE[size]} weight="bold">
          {logoName}
        </Text>
      </Row>
    </a>
  );
}
