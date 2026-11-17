import { Link } from 'react-router-dom';

type BrandLogoProps = {
  to?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
};

export function BrandLogo({
  to,
  size = 'md',
  showWordmark = true,
  className = '',
}: BrandLogoProps) {
  const content = (
    <>
      <img
        src="/cropo-logo.png"
        alt="CropO"
        className={`brand-logo-img brand-logo-img-${size}`}
      />
      {showWordmark && <span className="brand-word">CropO</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`brand-logo ${className}`.trim()}>
        {content}
      </Link>
    );
  }

  return <div className={`brand-logo ${className}`.trim()}>{content}</div>;
}
