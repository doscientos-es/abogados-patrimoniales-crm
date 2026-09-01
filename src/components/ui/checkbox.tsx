import { Checkbox as CheckboxPrimitive, type CheckboxProps } from '@doscientos/ui'

type LegacyCheckboxProps = Omit<CheckboxProps, 'defaultSelected' | 'isSelected' | 'onChange'> & {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  onChange?: (checked: boolean) => void
}

export function Checkbox({
  checked,
  defaultChecked,
  onChange,
  onCheckedChange,
  ...props
}: LegacyCheckboxProps) {
  return (
    <CheckboxPrimitive
      isSelected={checked ?? defaultChecked ?? false}
      onChange={(isSelected) => {
        onChange?.(isSelected)
        onCheckedChange?.(isSelected)
      }}
      {...props}
    />
  )
}
