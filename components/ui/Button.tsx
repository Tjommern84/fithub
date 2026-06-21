import Link from 'next/link';
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { buttonPrimary, buttonSecondary, buttonDestructive, buttonBrand, buttonForest } from '../../lib/ui';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'brand' | 'forest';

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
};

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: buttonPrimary,
  secondary: buttonSecondary,
  destructive: buttonDestructive,
  brand: buttonBrand,
  forest: buttonForest,
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}

export function ButtonLink({ variant = 'primary', className = '', ...props }: ButtonLinkProps) {
  return (
    <Link
      className={`${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}


