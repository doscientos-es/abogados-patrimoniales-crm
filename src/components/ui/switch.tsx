import { Switch as SwitchPrimitive, type SwitchProps } from '@doscientos/ui'

type LegacySwitchProps = Omit<SwitchProps, 'defaultSelected' | 'isSelected' | 'onChange'> & {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  onChange?: (checked: boolean) => void
}

function Switch({
  checked,
  defaultChecked,
  onChange,
  onCheckedChange,
  ...props
}: LegacySwitchProps) {
  return (
    <SwitchPrimitive
      isSelected={checked ?? defaultChecked ?? false}
      onChange={(isSelected) => {
        onChange?.(isSelected)
        onCheckedChange?.(isSelected)
      }}
      {...props}
    />
  )
}

export { Switch }
