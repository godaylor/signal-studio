import type { SVGProps } from 'react';

const SvgLogoWhite = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    viewBox="0 0 24 24"
    aria-hidden="true"
    {...props}
  >
    <image
      href={`${process.env.basePath || ''}/brand/kinorit/mark.svg`}
      width="24"
      height="24"
    />
  </svg>
);
export default SvgLogoWhite;
