interface AppBrandMarkProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  subtitle?: string;
}

const sizeMap = {
  sm: { title: "text-[15px]", subtitle: "text-[11px]" },
  md: { title: "text-[17px]", subtitle: "text-[12px]" },
  lg: { title: "text-[28px]", subtitle: "text-[13px]" },
} as const;

export function AppBrandMark({
  size = "md",
  showName = true,
  subtitle,
}: AppBrandMarkProps) {
  const s = sizeMap[size];

  if (!showName) return null;

  return (
    <div className="min-w-0">
      <p className={`${s.title} font-black tracking-tight text-white leading-none`}>
        Nexus Music
      </p>
      {subtitle && (
        <p className={`${s.subtitle} font-medium text-white/35 mt-1 truncate`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
