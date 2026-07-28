import { JfabLayoutPrincipal } from '@/components/jfab_layout_principal';

// Este arquivo de layout aplica o layout principal à rota de configurações.
export default function JfabConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <JfabLayoutPrincipal>{children}</JfabLayoutPrincipal>;
}
