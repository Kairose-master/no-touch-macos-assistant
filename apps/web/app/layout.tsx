import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
export const metadata: Metadata = { title: 'NoTouch · Local Rehearsal', description: 'Headless office assistant — isolated sample rehearsal' };
export default function RootLayout({ children }: { readonly children: ReactNode }) { return <html lang="ko"><body>{children}</body></html>; }
