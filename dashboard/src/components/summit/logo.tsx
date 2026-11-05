/** emet mark: the hand-drawn emet figure on cream paper (public/logo.png). */
export function LogoMark({ size = 28 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny static icon, next/image adds nothing here
  return <img src="/logo.png" width={size} height={size} alt="" aria-hidden className="shrink-0 rounded-[28%]" />;
}
