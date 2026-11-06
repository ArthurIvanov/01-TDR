import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md'

export type ButtonProps = {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = ['tds-button', `tds-button--${variant}`, `tds-button--${size}`]
  if (className) classes.push(className)

  return (
    <button
      type={type}
      className={classes.join(' ')}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}
