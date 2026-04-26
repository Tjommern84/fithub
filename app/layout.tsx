import './globals.css';
import type { ReactNode } from 'react';
import { Barlow_Condensed, Outfit, DM_Sans } from 'next/font/google';
import ConsentGate from '../components/ConsentGate';
import TopNav from '../components/TopNav';
import Footer from '../components/Footer';
import { LocationProvider } from '../lib/locationContext';

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  variable: '--font-barlow',
  weight: ['700'],
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500'],
  display: 'swap',
});

export const metadata = {
  title: 'FitHub',
  description: 'Finn trening som passer deg – lokale tilbydere over hele Norge',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="no" className={`${barlowCondensed.variable} ${outfit.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-[#f7f4ef] font-sans text-slate-900">
        <LocationProvider>
          <div className="flex min-h-screen flex-col">
            <TopNav />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <ConsentGate />
        </LocationProvider>
      </body>
    </html>
  );
}
