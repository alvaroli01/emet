/** Shown the instant a link is clicked, while the page's data loads. */
export default function Loading() {
  const block = "panel animate-pulse motion-reduce:animate-none";
  return (
    <div className="space-y-6" aria-busy="true">
      <div className={`${block} h-44 sm:h-56`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`${block} h-28`} />
        <div className={`${block} h-28`} />
        <div className={`${block} h-28`} />
      </div>
      <div className={`${block} h-64`} />
    </div>
  );
}
