import type { ReactNode, SVGProps } from 'react'

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  )
}

export const CubeIcon = () => (
  <Icon>
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="M3 7l9 5 9-5M12 12v10" />
  </Icon>
)
export const GaugeIcon = () => (
  <Icon>
    <path d="M12 14l4-4" />
    <path d="M3.3 17a9 9 0 1 1 17.4 0" />
  </Icon>
)
export const CheckIcon = () => (
  <Icon>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
)
export const TruckIcon = () => (
  <Icon>
    <path d="M1 4h13v12H1zM14 9h4l4 4v3h-8" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Icon>
)
export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
export const MinusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
)
export const HomeIcon = () => (
  <Icon>
    <path d="M3 11 12 3l9 8M5 9v12h14V9" />
  </Icon>
)
export const CloseIcon = () => (
  <Icon>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
)
export const PauseIcon = () => (
  <Icon width={16} height={16}>
    <path d="M8 5v14M16 5v14" />
  </Icon>
)
export const PlayIcon = () => (
  <Icon width={16} height={16}>
    <path d="M7 4l13 8-13 8z" />
  </Icon>
)
export const BellIcon = () => (
  <Icon>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Icon>
)
