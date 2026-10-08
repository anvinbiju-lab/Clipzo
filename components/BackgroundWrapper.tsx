'use client';

import dynamic from 'next/dynamic';

const AnimatedShaderBackground = dynamic(
  () => import('./ui/animated-shader-background'),
  { ssr: false }
);

export function BackgroundWrapper() {
  return <AnimatedShaderBackground />;
}
