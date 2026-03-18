import type { ComponentProps } from 'react';
import NavButton from '../NavButton';

type NavButtonProps = ComponentProps<typeof NavButton>;

const validIcon: NavButtonProps['icon'] = <svg />;
void validIcon;

// @ts-expect-error NavButton icons must be clonable React elements.
const invalidIcon: NavButtonProps['icon'] = 'icon';
void invalidIcon;
