'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type TrailMapComponent from './TrailMap';

const TrailMap = dynamic(() => import('./TrailMap'), { ssr: false });

type Props = ComponentProps<typeof TrailMapComponent>;

export default function TrailMapClient(props: Props) {
  return <TrailMap {...props} />;
}
