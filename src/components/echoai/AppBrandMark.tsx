interface AppBrandMarkProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  subtitle?: string;
}

const sizeMap = {
  sm: {
    title: "text-[15px]",
    subtitle: "text-[11px]",
    icon: 20,
    gap: "gap-2"
  },
  md: {
    title: "text-[17px]",
    subtitle: "text-[12px]",
    icon: 26,
    gap: "gap-2.5"
  },
  lg: {
    title: "text-[26px]",
    subtitle: "text-[13px]",
    icon: 40,
    gap: "gap-3.5"
  },
} as const;

export function AppBrandMark({
  size = "md",
  showName = true,
  subtitle,
}: AppBrandMarkProps) {
  const s = sizeMap[size];

  const logoIcon = (
    <svg
      width={s.icon}
      height={s.icon}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
    >
      <path
        d="M 172 340 C 172 230, 214 172, 256 256 C 298 340, 340 282, 340 172"
        stroke="#FFFFFF"
        strokeWidth="36"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!showName) {
    return logoIcon;
  }

  return (
    <div className={`flex items-center ${s.gap} min-w-0`}>
      {logoIcon}
      <div className="min-w-0 leading-none">
        <p className={`${s.title} font-black tracking-tight text-white`}>
          Nexus Music
        </p>
        {subtitle && (
          <p className={`${s.subtitle} font-medium text-white/35 mt-1 truncate`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

