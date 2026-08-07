'use client';

import React, { useEffect, useState, useRef } from 'react';
import { arc, pie, PieArcDatum } from 'd3-shape';
import { CategoryIcon } from '@/components/CategoryIcon';
import { formatINR } from '@/lib/types';

export interface WheelData {
  label: string;
  icon: string;
  color: string;
  current: number;
  limit: number;
}

export interface FocusWheelProps {
  data: WheelData[];
  size?: number;
  strokeWidth?: number;
  gapAngle?: number;
  children?: React.ReactNode;
}

export function FocusWheel({ data, size = 320, strokeWidth = 60, gapAngle = 4, children }: FocusWheelProps) {
  const [progress, setProgress] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const rafRef = useRef<number>(0);
  
  // Entry animation
  useEffect(() => {
    const duration = 1000;
    const startTime = performance.now();
    
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const easeOut = 1 - Math.pow(1 - t, 3);
      setProgress(easeOut);
      
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const radius = size / 2;
  const innerRadius = radius - strokeWidth;
  const gapRad = (gapAngle * Math.PI) / 180;
  
  const activeData = data.filter(d => d.limit > 0);

  if (activeData.length === 0) {
    return (
      <div style={{ width: size, height: size, position: 'relative' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
           <circle cx={radius} cy={radius} r={radius - strokeWidth/2} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      </div>
    );
  }

  // Create equal-width pie slices
  const pieGenerator = pie<WheelData>()
    .value(1) // equal width
    .padAngle(gapRad)
    .sort(null); // Keep original array order

  const arcs = pieGenerator(activeData);

  const backgroundArc = arc<PieArcDatum<WheelData>>()
    .innerRadius(innerRadius)
    .outerRadius(radius)
    .cornerRadius(8);

  const backgroundArcHovered = arc<PieArcDatum<WheelData>>()
    .innerRadius(innerRadius)
    .outerRadius(radius + 8) // Pop out slightly
    .cornerRadius(8);

  // Generate paths
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        <g transform={`translate(${radius}, ${radius})`}>
          {arcs.map((d, i) => {
            const isHovered = hoveredIndex === i;
            const isFaded = hoveredIndex !== null && !isHovered;
            const opacity = isFaded ? 0.3 : 1;
            
            const cap = d.data.limit;
            const spent = d.data.current;
            const pct = Math.max(0, Math.min(spent / cap, 1));
            const isOverflow = spent > cap;
            
            // Calculate the filled outer radius based on progress and percentage
            const baseOuterRadius = isHovered ? radius + 8 : radius;
            const maxThickness = baseOuterRadius - innerRadius;
            const currentThickness = maxThickness * (pct * progress);
            const filledOuterRadius = innerRadius + currentThickness;
            
            const foregroundArc = arc<any>()
              .innerRadius(innerRadius)
              .outerRadius(filledOuterRadius)
              .cornerRadius(8)
              // Pass custom object mapping start/end angle
              ({
                startAngle: d.startAngle,
                endAngle: d.endAngle,
                padAngle: d.padAngle,
                innerRadius,
                outerRadius: filledOuterRadius
              });
              
            const bgPath = (isHovered ? backgroundArcHovered(d) : backgroundArc(d)) as string;
            const fgPath = foregroundArc as string;
            
            // Centroid for icon placement
            const centroid = backgroundArc.centroid(d);
            
            return (
              <g 
                key={d.data.label} 
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHoveredIndex(i); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHoveredIndex(null); }}
                onClick={() => setHoveredIndex(hoveredIndex === i ? null : i)}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s ease', opacity, WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Background Track */}
                <path d={bgPath} fill={d.data.color} fillOpacity={0.15} style={{ transition: 'd 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                
                {/* Foreground Fill */}
                {pct > 0 && progress > 0 && (
                  <path d={fgPath} fill={isOverflow ? 'var(--danger)' : d.data.color} style={{ transition: 'd 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                )}
                
                {/* Category Icon */}
                <g transform={`translate(${centroid[0]}, ${centroid[1]})`} style={{ pointerEvents: 'none' }}>
                  <foreignObject x={-12} y={-12} width={24} height={24}>
                    <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isOverflow ? '#fff' : (pct > 0.5 ? '#fff' : d.data.color) }}>
                       <CategoryIcon name={d.data.icon} size={16} />
                    </div>
                  </foreignObject>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
      
      {/* Center Details */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        {hoveredIndex !== null ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.2s ease' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: activeData[hoveredIndex].color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {activeData[hoveredIndex].label}
            </span>
            <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginTop: 4 }}>
              {formatINR(activeData[hoveredIndex].current)}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              of {formatINR(activeData[hoveredIndex].limit)} budget
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: activeData[hoveredIndex].current >= activeData[hoveredIndex].limit ? 'var(--danger)' : 'var(--text-primary)', marginTop: 6 }}>
              {formatINR(Math.max(0, activeData[hoveredIndex].limit - activeData[hoveredIndex].current))} left
            </span>
          </div>
        ) : (
          children
        )}
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}