import {
  Button,
  Sheet as SheetPrimitive,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@doscientos/ui'
import * as React from 'react'

type SheetState = { open: boolean; setOpen: (open: boolean) => void }
const SheetContext = React.createContext<SheetState | null>(null)

function useSheet() {
  const context = React.useContext(SheetContext)
  if (!context) throw new Error('Sheet components must be rendered within Sheet.')
  return context
}

export function Sheet({
  children,
  defaultOpen = false,
  onOpenChange,
  open: controlledOpen,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  open?: boolean
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }
  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>
}

export function SheetTrigger({
  asChild = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { open, setOpen } = useSheet()
  const onClick: React.MouseEventHandler<HTMLElement> = (event) => {
    props.onClick?.(event as React.MouseEvent<HTMLButtonElement>)
    if (!event.defaultPrevented) setOpen(!open)
  }
  if (
    asChild &&
    React.isValidElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>(children)
  ) {
    return React.cloneElement(children, {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        children.props.onClick?.(event)
        onClick(event)
      },
    })
  }
  return (
    <button type="button" {...props} onClick={onClick}>
      {children}
    </button>
  )
}

export function SheetContent({
  children,
  side = 'right',
  ...props
}: Omit<React.ComponentProps<typeof SheetPrimitive>, 'isOpen' | 'onOpenChange'> & {
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  const { open, setOpen } = useSheet()
  return (
    <SheetPrimitive {...props} side={side} isOpen={open} onOpenChange={setOpen}>
      {children}
    </SheetPrimitive>
  )
}

export function SheetClose({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { setOpen } = useSheet()
  return (
    <Button
      {...props}
      onClick={(event) => {
        props.onClick?.(event)
        if (!event.defaultPrevented) setOpen(false)
      }}
    >
      {children}
    </Button>
  )
}

export { SheetDescription, SheetFooter, SheetHeader, SheetTitle }
