import Link from "next/link";

export function SiteIdentityFooter() {
  return (
    <footer className="relative z-20 border-t border-white/5 bg-[#050505]/95 px-6 py-5 text-sm text-white/45">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-white font-bold tracking-tight">Nexus Music</p>
          <p className="mt-1 max-w-xl leading-relaxed">
            AI-powered music dashboard with YouTube playback, personalized recommendations, and social listening.
          </p>
          <p className="mt-2 text-white/30">
            Developed by{" "}
            <a
              href="https://nadeesha.site"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 hover:text-white transition-colors"
            >
              Nadeesha Malshan
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-white/40">
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms of Service
          </Link>
          <a
            href="mailto:malshannandanayaka@gmail.com"
            className="hover:text-white transition-colors"
          >
            malshannandanayaka@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
