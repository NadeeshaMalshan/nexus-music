import Image from "next/image";

interface AppBrandMarkProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  subtitle?: string;
}

const sizeMap = {
  sm: { box: 32, image: 32, title: "text-[15px]", subtitle: "text-[11px]" },
  md: { box: 40, image: 40, title: "text-[17px]", subtitle: "text-[12px]" },
  lg: { box: 56, image: 56, title: "text-[28px]", subtitle: "text-[13px]" },
} as const;

export function AppBrandMark({
  size = "md",
  showName = true,
  subtitle,
}: AppBrandMarkProps) {
  const s = sizeMap[size];

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="relative shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10"
        style={{ width: s.box, height: s.box }}
      >
        <Image
          src="/brand/nexus-music-logo.svg"
          alt="Nexus Music logo"
          width={s.image}
          height={s.image}
          className="h-full w-full object-cover"
          priority
        />
      </div>
      {showName && (
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
      )}
    </div>
  );
}
