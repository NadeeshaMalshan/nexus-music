"use client";

import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface MarqueeTextProps {
  text: string;
  className?: string;
  speed?: number; // pixels per second
  gap?: number;
  active?: boolean;
}

export function MarqueeText({ text, className, speed = 35, gap = 50, active = true }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const cWidth = containerRef.current.offsetWidth;
        // Create a temporary element to measure full text width without constraints
        const span = document.createElement("span");
        span.style.visibility = "hidden";
        span.style.position = "absolute";
        span.style.whiteSpace = "nowrap";
        span.style.font = window.getComputedStyle(containerRef.current).font;
        span.innerText = text;
        document.body.appendChild(span);
        const tWidth = span.offsetWidth;
        document.body.removeChild(span);

        setContainerWidth(cWidth);
        setTextWidth(tWidth);
        setIsOverflowing(tWidth > cWidth && cWidth > 0);
      }
    };

    measure();
    const timer = setTimeout(measure, 500); // Check again after animation
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(timer);
    };
  }, [text]);

  if (!isOverflowing || !active) {
    return (
      <div ref={containerRef} className={`truncate w-full block ${className}`}>
        {text}
      </div>
    );
  }

  const duration = (textWidth + gap) / (speed || 35);

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full overflow-hidden whitespace-nowrap block ${className}`}
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 15px, black calc(100% - 15px), transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 15px, black calc(100% - 15px), transparent)',
      }}
    >
      <m.div
        key={`${text}-${textWidth}`}
        animate={{ x: [0, -(textWidth + gap)] }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatDelay: 2,
        }}
        className="inline-block"
      >
        <span className="inline-block" style={{ paddingRight: `${gap}px` }}>
          {text}
        </span>
        <span className="inline-block" style={{ paddingRight: `${gap}px` }}>
          {text}
        </span>
      </m.div>
    </div>
  );
}
