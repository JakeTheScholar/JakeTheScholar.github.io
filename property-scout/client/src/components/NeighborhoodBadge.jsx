export default function NeighborhoodBadge({ badge, score }) {
  if (!badge) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${badge.class}`}>
      {badge.label}
      {score != null && <span className="opacity-70">{score}/10</span>}
    </span>
  );
}
