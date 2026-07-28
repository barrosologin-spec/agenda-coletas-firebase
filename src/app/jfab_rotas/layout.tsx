import { JfabLayoutPrincipal } from '@/components/jfab_layout_principal';

// Este arquivo de layout aplica o layout principal à rota de gerenciamento de rotas.
export default function JfabRotasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <JfabLayoutPrincipal>{children}</JfabLayoutPrincipal>;
}
