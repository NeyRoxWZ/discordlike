'use client';

import Image from 'next/image';

interface Props {
  src: string;
  alt: string;
  className?: string;
}

export function RemoteImage({ src, alt, className }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      className={className}
      unoptimized
      loader={({ src: s }) => s}
    />
  );
}

