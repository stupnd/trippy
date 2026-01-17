'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionValueEvent } from 'framer-motion';

export default function CustomCursor() {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [magneticTarget, setMagneticTarget] = useState<{ x: number; y: number } | null>(null);

  // Mouse position (raw)
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Spring animations for smooth following
  const springConfig = { damping: 30, stiffness: 300, mass: 0.5 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  // Magnetic offset (will be calculated based on cursor position and target)
  const magneticOffsetX = useMotionValue(0);
  const magneticOffsetY = useMotionValue(0);

  // Transform for scale on hover
  const scale = useSpring(isHovering ? 2 : 1, springConfig);

  // Update magnetic offset based on cursor position and target
  useMotionValueEvent(cursorX, 'change', (x) => {
    if (magneticTarget) {
      const y = cursorY.get();
      const dx = magneticTarget.x - x;
      const dy = magneticTarget.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Magnetic effect: stronger when closer
      const maxDistance = 120;
      const strength = 0.2;
      
      if (distance < maxDistance) {
        const factor = 1 - distance / maxDistance; // 0 to 1
        magneticOffsetX.set(dx * strength * factor);
        magneticOffsetY.set(dy * strength * factor);
      } else {
        magneticOffsetX.set(0);
        magneticOffsetY.set(0);
      }
    }
  });

  useMotionValueEvent(cursorY, 'change', (y) => {
    if (magneticTarget) {
      const x = cursorX.get();
      const dx = magneticTarget.x - x;
      const dy = magneticTarget.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const maxDistance = 120;
      const strength = 0.2;
      
      if (distance < maxDistance) {
        const factor = 1 - distance / maxDistance;
        magneticOffsetX.set(dx * strength * factor);
        magneticOffsetY.set(dy * strength * factor);
      } else {
        magneticOffsetX.set(0);
        magneticOffsetY.set(0);
      }
    }
  });

  useEffect(() => {
    // Initialize cursor position to current mouse position if available
    const handleInitialMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      setIsVisible(true);
      // Remove after first move to prevent unnecessary updates
      window.removeEventListener('mousemove', handleInitialMouseMove);
    };

    const updateCursorPosition = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      setIsVisible(true);
    };

    // Listen for initial mouse move
    window.addEventListener('mousemove', handleInitialMouseMove, { once: true });

    const handleMouseLeave = (e: MouseEvent) => {
      // Only hide if leaving the window entirely
      if (e.clientY <= 0 || e.clientX <= 0 || 
          e.clientX >= window.innerWidth || 
          e.clientY >= window.innerHeight) {
        setIsVisible(false);
      }
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    // Track hover state on interactive elements
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a') ||
        target.closest('button') ||
        target.closest('[role="button"]') ||
        target.closest('.glass-card-hover') ||
        target.closest('[data-cursor-hover]');

      if (isInteractive) {
        setIsHovering(true);
        // Find magnetic target (center of the interactive element)
        const element = (
          target.closest('a') || 
          target.closest('button') || 
          target.closest('[role="button"]') || 
          target.closest('.glass-card-hover') ||
          target.closest('[data-cursor-hover]')
        ) as HTMLElement;
        
        if (element) {
          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          setMagneticTarget({ x: centerX, y: centerY });
        }
      } else {
        setIsHovering(false);
        setMagneticTarget(null);
        magneticOffsetX.set(0);
        magneticOffsetY.set(0);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      // Check if we're leaving an interactive element
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!relatedTarget || !relatedTarget.closest) {
        setIsHovering(false);
        setMagneticTarget(null);
        magneticOffsetX.set(0);
        magneticOffsetY.set(0);
        return;
      }

      const isStillInteractive =
        relatedTarget.tagName === 'A' ||
        relatedTarget.tagName === 'BUTTON' ||
        relatedTarget.closest('a') ||
        relatedTarget.closest('button') ||
        relatedTarget.closest('[role="button"]') ||
        relatedTarget.closest('.glass-card-hover') ||
        relatedTarget.closest('[data-cursor-hover]');

      if (!isStillInteractive) {
        setIsHovering(false);
        setMagneticTarget(null);
        magneticOffsetX.set(0);
        magneticOffsetY.set(0);
      }
    };

    window.addEventListener('mousemove', updateCursorPosition);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', updateCursorPosition);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [mouseX, mouseY, magneticOffsetX, magneticOffsetY]);

  // Final position with magnetic offset (using springs for smooth magnetic effect)
  const magneticSpringConfig = { damping: 25, stiffness: 200, mass: 0.3 };
  const finalOffsetX = useSpring(magneticOffsetX, magneticSpringConfig);
  const finalOffsetY = useSpring(magneticOffsetY, magneticSpringConfig);

  const finalX = useTransform([cursorX, finalOffsetX], ([x, offset]) => x + offset);
  const finalY = useTransform([cursorY, finalOffsetY], ([y, offset]) => y + offset);

  // Outer glow ring springs (with more delay for trailing effect)
  const outerSpringConfig = { ...springConfig, damping: 25 };
  const outerCursorX = useSpring(cursorX, outerSpringConfig);
  const outerCursorY = useSpring(cursorY, outerSpringConfig);
  const outerScale = useTransform(scale, (s) => s * 1.5);

  if (!isVisible) return null;

  return (
    <>
      {/* Main cursor ring */}
      <motion.div
        className={`fixed top-0 left-0 pointer-events-none z-[9999] ${
          isHovering ? 'mix-blend-difference' : ''
        }`}
        style={{
          x: finalX,
          y: finalY,
          scale,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 backdrop-blur-sm bg-white/10" />
      </motion.div>

      {/* Outer glow ring (follows with more delay) */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9998]"
        style={{
          x: outerCursorX,
          y: outerCursorY,
          scale: outerScale,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovering ? 0.3 : 0.1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 backdrop-blur-sm" />
      </motion.div>
    </>
  );
}
