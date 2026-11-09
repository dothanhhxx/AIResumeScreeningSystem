/**
 * Placeholder blocks shown while the first response loads.
 * Refetches should keep the previous content on screen instead (no flash).
 */
export function Skeleton({
  width = "100%",
  height = 14,
  radius = 6,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
}) {
  return (
    <span
      className="skeleton"
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** A panel-shaped placeholder with a title bar and a few text lines. */
export function SkeletonPanel({
  lines = 4,
  height,
}: {
  lines?: number;
  height?: number;
}) {
  return (
    <div className="skeleton-panel" aria-hidden="true">
      <Skeleton width="38%" height={16} />
      <Skeleton width="62%" height={12} />
      {height ? (
        <Skeleton height={height} radius={10} />
      ) : (
        Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} width={`${92 - index * 9}%`} />
        ))
      )}
    </div>
  );
}
