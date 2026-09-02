import {
  Button as DoscientosButton,
  buttonVariants,
  type ButtonProps as DoscientosButtonProps,
} from '@doscientos/ui'
import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'

export { buttonVariants }

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

/** Compatibilidad para atributos HTML de los botones legacy sobre el control compartido. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <DoscientosButton ref={ref} {...(props as unknown as DoscientosButtonProps)} />
))
Button.displayName = 'Button'
