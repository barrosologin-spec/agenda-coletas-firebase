import type { Metadata } from 'next';
import { PT_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/jfab_seletor_tema';

// Configuração da fonte PT Sans, conforme solicitado.
const jfab_font = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-jfab-sans',
});

export const metadata: Metadata = {
  title: 'JFAB SISTEMAS - CONTROLE DE TRANSPORTS, ENVIOS E COLETAS',
  description: 'Sistema de agendamento e gerenciamento de coletas.',
  icons: {
    icon: '/favicon.ico',
  },
};

// Layout principal da aplicação.
// A classe da fonte é aplicada aqui, junto com o antialiasing para melhor legibilidade.
export default function JfabRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${jfab_font.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
