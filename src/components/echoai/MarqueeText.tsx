"use client";

import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface MarqueeTextProps {
  text: string;
  children?: React.ReactNode;
  className?: string;
  speed?: number; // pixels per second
  gap?: number;
  active?: boolean;
}

export function MarqueeText({ text, children, className, speed = 35, gap = 50, active = true }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current && measureRef.current) {
        const cWidth = containerRef.current.offsetWidth;
        const tWidth = measureRef.current.offsetWidth;
        
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
  }, [text, children]);

  const duration = (textWidth + gap) / (speed || 35);

  return (
    <>
      {/* Hidden element for measuring actual rendered width */}
      <div 
        ref={measureRef} 
        className={`absolute top-0 left-0 invisible whitespace-nowrap w-max pointer-events-none ${className || ''}`}
        aria-hidden="true"
      >
        {children || text}
      </div>

      {(!isOverflowing || !active) ? (
        <div ref={containerRef} className={`truncate w-full block ${className || ''}`}>
          {children || text}
        </div>
      ) : (
        <div 
          ref={containerRef} 
          className={`relative w-full overflow-hidden whitespace-nowrap block ${className || ''}`}
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
              {children || text}
            </span>
            <span className="inline-block" style={{ paddingRight: `${gap}px` }}>
              {children || text}
            </span>
          </m.div>
        </div>
      )}
    </>
  );
}
