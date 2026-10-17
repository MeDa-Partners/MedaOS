const PALETTE = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({
  name,
  seed,
  size = 'md',
  square = false,
}: {
  name: string;
  seed?: string;
  size?: 'sm' | 'md' | 'lg';
  square?: boolean;
}) {
  const sizes = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-11 h-11 text-sm' }[size];
  return (
    <span
      aria-hidden="true"
      className={`${sizes} ${colorFor(seed || name)} ${
        square ? 'rounded-lg' : 'rounded-full'
      } inline-flex items-center justify-center font-semibold shrink-0 select-none`}
    >
      {initials(name)}
    </span>
  );
}
