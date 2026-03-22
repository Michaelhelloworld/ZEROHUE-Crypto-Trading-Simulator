import React from 'react';
import { CONTACT_EMAIL } from '../../constants/branding';
import ObfuscatedEmail from './ObfuscatedEmail';

interface SupportEmailLinkProps {
  className?: string;
  label?: string;
}

const [supportUser, supportDomain] = CONTACT_EMAIL.split('@');

const SupportEmailLink: React.FC<SupportEmailLinkProps> = ({ className, label }) => (
  <ObfuscatedEmail user={supportUser} domain={supportDomain} className={className} label={label} />
);

export default SupportEmailLink;
