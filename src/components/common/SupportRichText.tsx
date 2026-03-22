import React from 'react';
import { SUPPORT_CONTACT_TOKEN } from '../../content/publicContent';
import SupportEmailLink from './SupportEmailLink';

interface SupportRichTextProps {
  text: string;
  linkClassName?: string;
  linkLabel?: string;
}

const SupportRichText: React.FC<SupportRichTextProps> = ({
  text,
  linkClassName,
  linkLabel = 'our official support email',
}) => {
  const parts = text.split(SUPPORT_CONTACT_TOKEN);

  if (parts.length === 1) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 ? (
            <SupportEmailLink className={linkClassName} label={linkLabel} />
          ) : null}
        </React.Fragment>
      ))}
    </>
  );
};

export default SupportRichText;
