interface Props {
  children: React.ReactNode;
}

/**
 * PageWrapper — layout shell for interior pages. The blur overlay that
 * previously lived here as .page-bg has been lifted to App.tsx (BlurOverlay)
 * so it stays outside framer-motion transform contexts and never flickers.
 */
export default function PageWrapper({ children }: Props) {
  return (
    <div className="page-wrapper">
      {children}
    </div>
  );
}
