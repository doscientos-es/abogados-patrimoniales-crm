import * as React from "react";

import { cn } from "@doscientos/ui";

type MenuState = { open: boolean; setOpen: (open: boolean) => void };
const MenuContext = React.createContext<MenuState | null>(null);

function useMenu() {
  const context = React.useContext(MenuContext);
  if (!context) throw new Error("DropdownMenu components must be rendered within DropdownMenu.");
  return context;
}

export function DropdownMenu({
  children,
  defaultOpen = false,
  onOpenChange,
  open: controlledOpen,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return <MenuContext.Provider value={{ open, setOpen }}>{children}</MenuContext.Provider>;
}

export function DropdownMenuTrigger({
  asChild = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { open, setOpen } = useMenu();
  const onClick: React.MouseEventHandler<HTMLElement> = (event) => {
    props.onClick?.(event as React.MouseEvent<HTMLButtonElement>);
    if (!event.defaultPrevented) setOpen(!open);
  };

  if (
    asChild &&
    React.isValidElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>(children)
  ) {
    return React.cloneElement(children, {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        children.props.onClick?.(event);
        onClick(event);
      },
    });
  }

  return (
    <button type="button" {...props} onClick={onClick}>
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  className,
  align: _align,
  side: _side,
}: React.HTMLAttributes<HTMLDivElement> & { align?: string; side?: string; sideOffset?: number }) {
  const { open } = useMenu();
  if (!open) return null;
  return (
    <div
      role="menu"
      className={cn(
        "z-50 min-w-32 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  asChild = false,
  children,
  className,
  disabled,
  inset,
  onSelect,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> & {
  asChild?: boolean;
  inset?: boolean;
  onSelect?: (event: Event) => void;
}) {
  const { setOpen } = useMenu();
  const select = (event: React.MouseEvent<HTMLElement>) => {
    onSelect?.(event.nativeEvent);
    if (!event.defaultPrevented) setOpen(false);
  };
  const itemClassName = cn(
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
    inset && "pl-7",
    className,
  );

  if (
    asChild &&
    React.isValidElement<{
      className?: string;
      onClick?: React.MouseEventHandler<HTMLElement>;
    }>(children)
  ) {
    return React.cloneElement(children, {
      className: cn(itemClassName, children.props.className),
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        children.props.onClick?.(event);
        select(event);
      },
    });
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={itemClassName}
      disabled={disabled}
      onClick={select}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuItem> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <DropdownMenuItem
      {...props}
      onSelect={(event) => {
        onCheckedChange?.(!checked);
        props.onSelect?.(event);
      }}
    />
  );
}

export const DropdownMenuGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DropdownMenuPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DropdownMenuSub = DropdownMenuGroup;
export const DropdownMenuSubContent = DropdownMenuContent;
export const DropdownMenuSubTrigger = DropdownMenuItem;
export const DropdownMenuRadioGroup = DropdownMenuGroup;
export const DropdownMenuRadioItem = DropdownMenuItem;
export const DropdownMenuLabel = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />
);
export const DropdownMenuSeparator = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
);
export const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
);
