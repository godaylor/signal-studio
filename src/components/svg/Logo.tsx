import type { SVGProps } from 'react';

const SvgLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
    {...props}
  >
    <rect x="3" y="10" width="4" height="11" rx="2" />
    <rect x="10" y="3" width="4" height="18" rx="2" />
    <rect x="17" y="7" width="4" height="14" rx="2" />
  </svg>
);
export default SvgLogo;
