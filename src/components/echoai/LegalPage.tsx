"use client";

import React from "react";
import Link from "next/link";
import { m } from "motion/react";
import { FileText } from "lucide-react";
import { useDashboard } from "@/context/DashboardContext";

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  list?: string[];
  content?: React.ReactNode;
}

export function LegalContactBlock({ intro }: { intro: string }) {
  return (
    <div className="space-y-4">
      <p className="text-white/50 text-[15px] font-medium leading-relaxed">{intro}</p>
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 px-5 py-4 space-y-2">
        <p className="text-white font-semibold text-[16px] tracking-tight">Nadeesha Malshan</p>
        <a
          href="https://nadeesha.site"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-white/60 hover:text-white text-[15px] font-medium transition-colors"
        >
          nadeesha.site
        </a>
        <a
          href="mailto:malshannandanayaka@gmail.com"
          className="block text-white/60 hover:text-white text-[15px] font-medium transition-colors"
        >
          malshannandanayaka@gmail.com
        </a>
      </div>
    </div>
  );
}

interface LegalPageProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
  sibling?: { label: string; href: string };
}

export function LegalPage({
  title,
  subtitle,
  lastUpdated,
  sections,
  sibling,
}: LegalPageProps) {
  const { isRightSidebarOpen } = useDashboard();

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1] as const,
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div
      className={`flex-1 h-full overflow-y-auto bg-transparent px-4 py-8 md:px-10 md:py-12 lg:px-16 pb-40 custom-scrollbar transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
      }`}
    >
      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-4xl mr-auto animate-gpu"
      >
        <header className="mb-14">
          <div className="flex items-center gap-2 mb-6 text-white/30 uppercase tracking-widest text-[11px] font-bold">
            <FileText size={14} />
            <span>Legal</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-none mb-4">
            {title}
          </h1>
          <p className="text-[20px] font-medium text-white/40">{subtitle}</p>
          <p className="text-white/20 text-[13px] font-medium mt-4">
            Last updated: {lastUpdated}
          </p>
        </header>

        <div className="space-y-6">
          {sections.map((section) => (
            <m.section
              key={section.title}
              variants={itemVariants}
              className="bg-white/2 border border-white/5 rounded-[28px] px-8 py-7"
            >
              <h2 className="text-xl font-bold text-white tracking-tight mb-4">
                {section.title}
              </h2>
              <div className="space-y-4">
                {section.content}
                {section.paragraphs?.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 48)}
                    className="text-white/50 text-[15px] font-medium leading-relaxed"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.list && section.list.length > 0 && (
                  <ul className="space-y-2.5 pl-1">
                    {section.list.map((item) => (
                      <li
                        key={item.slice(0, 48)}
                        className="flex gap-3 text-white/50 text-[15px] font-medium leading-relaxed"
                      >
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20"
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </m.section>
          ))}
        </div>

        <footer className="mt-16 text-center pb-12 space-y-4">
          {sibling && (
            <p className="text-white/30 text-[14px] font-medium">
              See also{" "}
              <Link
                href={sibling.href}
                className="text-white/60 hover:text-white underline underline-offset-4 transition-colors"
              >
                {sibling.label}
              </Link>
            </p>
          )}
          <div className="flex items-center justify-center gap-2 text-white/20 font-bold tracking-tight">
            <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
              <span className="text-[14px]">N</span>
            </div>
            <span>NEXUS MUSIC</span>
          </div>
          <p className="text-white/10 text-[12px] font-medium">
            Version 2.4.0 (2024.04)
          </p>
        </footer>
      </m.div>
    </div>
  );
}
