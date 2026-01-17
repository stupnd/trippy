'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function BackgroundOrb() {
  const [isVisible, setIsVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Mouse position (raw)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring animations for smooth, lazy following
  // High damping and lower stiffness for liquid/floating effect
  const springConfig = { damping: 50, stiffness: 150, mass: 1.5 };
  const orbX = useSpring(mouseX, springConfig);
  const orbY = useSpring(mouseY, springConfig);

  useEffect(() => {
    // Detect touch device
    const checkTouchDevice = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore
        (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
      );
    };

    checkTouchDevice();

    // Update orb position on mouse move
    const updateMousePosition = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      setIsVisible(true);
    };

    // Hide orb when mouse leaves viewport
    const handleMouseLeave = (e: MouseEvent) => {
      if (
        e.clientY <= 0 ||
        e.clientX <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        setIsVisible(false);
      }
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    if (!isTouchDevice) {
      window.addEventListener('mousemove', updateMousePosition);
      document.addEventListener('mouseleave', handleMouseLeave);
      document.addEventListener('mouseenter', handleMouseEnter);
    }

    return () => {
      if (!isTouchDevice) {
        window.removeEventListener('mousemove', updateMousePosition);
        document.removeEventListener('mouseleave', handleMouseLeave);
        document.removeEventListener('mouseenter', handleMouseEnter);
      }
    };
  }, [mouseX, mouseY, isTouchDevice]);

  // Don't render on touch devices
  if (isTouchDevice || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Main orb with gradient and blur - brighter */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none -z-10"
        style={{
          x: orbX,
          y: orbY,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 1 }}
      >
        <div className="w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-orange-400 via-rose-400 to-pink-400 blur-3xl" />
      </motion.div>

      {/* Secondary orb for depth (cyan-blue variant with subtle movement) - brighter */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none -z-10"
        style={{
          x: orbX,
          y: orbY,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 1.2 }}
      >
        <motion.div
          className="w-[300px] h-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 blur-3xl"
          animate={{
            x: ['0%', '10%', '-10%', '0%'],
            y: ['0%', '-10%', '10%', '0%'],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>
    </>
  );
}
