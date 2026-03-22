import React from 'react';

interface ObfuscatedEmailProps {
  user: string;
  domain: string;
  className?: string;
  label?: string;
}

const ObfuscatedEmail: React.FC<ObfuscatedEmailProps> = ({ user, domain, className, label }) => {
  const fullEmail = `${user}@${domain}`;
  const reversedEmail = fullEmail.split('').reverse().join('');
  const mailtoHref = `mailto:${fullEmail}`;

  if (label) {
    return (
      <a href={mailtoHref} className={className}>
        {label}
      </a>
    );
  }

  return (
    <a
      href={mailtoHref}
      aria-label="Email support"
      className={className}
      style={{ unicodeBidi: 'bidi-override', direction: 'rtl' }}
    >
      {reversedEmail}
    </a>
  );
};

export default ObfuscatedEmail;
