import { CONFIG } from "../config";

interface Props {
  children: React.ReactNode;
}

export default function PageWrapper({ children }: Props) {
  return (
    <div className="page-wrapper">
      <div className="page-bg" style={{ backgroundImage: `url(${CONFIG.backgroundImage})` }} />
      {children}
    </div>
  );
}
