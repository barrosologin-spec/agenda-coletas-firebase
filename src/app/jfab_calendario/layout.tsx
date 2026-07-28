import { JfabLayoutPrincipal } from '@/components/jfab_layout_principal';

// Este arquivo de layout aplica o layout principal à rota de calendário.
export default function JfabCalendarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <JfabLayoutPrincipal>{children}</JfabLayoutPrincipal>;
}
