import React from 'react';

interface ZeroHueLogoProps {
  small?: boolean;
  className?: string;
}

const ZeroHueLogo: React.FC<ZeroHueLogoProps> = ({ small, className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Main Container */}
      <div
        className={`
          relative flex items-center justify-center
          ${small ? 'w-8 h-8' : 'w-10 h-10'}
        `}
      >
        {/* Stylized Logo Image */}
        <img
          src="/logo.png"
          alt="ZEROHUE"
          className={`object-contain ${small ? 'w-8 h-8' : 'w-10 h-10'}`}
        />
      </div>
    </div>
  );
};

export default React.memo(ZeroHueLogo);
