/** A project's icon: the uploaded photo, or a coloured tile with the first letter. */
export function ProjectIcon({ url, color, name, size = 40 }: { url?: string | null; color: string; name: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-xl object-cover ring-1 ring-line" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-xl font-semibold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {name.trim().charAt(0).toUpperCase() || "·"}
    </span>
  );
}
