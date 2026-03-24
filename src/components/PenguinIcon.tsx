import type { SVGProps } from 'react'

export default function PenguinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <ellipse cx="32" cy="35" rx="17" ry="22" fill="#111827" />
      <ellipse cx="32" cy="37" rx="10.5" ry="14.5" fill="#F9FAFB" />
      <circle cx="25" cy="24" r="2.2" fill="#F9FAFB" />
      <circle cx="39" cy="24" r="2.2" fill="#F9FAFB" />
      <circle cx="25" cy="24" r="1.2" fill="#111827" />
      <circle cx="39" cy="24" r="1.2" fill="#111827" />
      <path d="M32 27L27 31H37L32 27Z" fill="#F59E0B" />
      <ellipse cx="17.5" cy="36" rx="3.3" ry="8.6" fill="#1F2937" />
      <ellipse cx="46.5" cy="36" rx="3.3" ry="8.6" fill="#1F2937" />
      <ellipse cx="24.5" cy="57" rx="6" ry="2.4" fill="#F59E0B" />
      <ellipse cx="39.5" cy="57" rx="6" ry="2.4" fill="#F59E0B" />
    </svg>
  )
}
