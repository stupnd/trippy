'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { Users, Sparkles, MapPin, Calendar, Target } from 'lucide-react';

// Destination chips data
const destinationChips = [
  { name: 'Tokyo', emoji: '🗼' },
  { name: 'Bali', emoji: '🏝️' },
  { name: 'Lisbon', emoji: '🏰' },
  { name: 'Paris', emoji: '🗼' },
  { name: 'Iceland', emoji: '🧊' },
  { name: 'Morocco', emoji: '🏜️' },
  { name: 'Santorini', emoji: '🌅' },
  { name: 'Barcelona', emoji: '🏖️' },
  { name: 'Kyoto', emoji: '🍜' },
  { name: 'Dubai', emoji: '🌆' },
  { name: 'Maldives', emoji: '🏝️' },
  { name: 'Thailand', emoji: '🌴' },
  { name: 'Switzerland', emoji: '⛰️' },
  { name: 'Greece', emoji: '🏛️' },
  { name: 'Vietnam', emoji: '🍜' },
];

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Mouse tracking for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { damping: 30, stiffness: 200 });
  const springY = useSpring(mouseY, { damping: 30, stiffness: 200 });


  // Scroll-based transforms
  const cloudOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const cloudScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  const mapOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1]);
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -200]);
  const featuresY = useTransform(scrollYProgress, [0.5, 1], [100, 0]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        mouseX.set((e.clientX - rect.left - rect.width / 2) * 0.01);
        mouseY.set((e.clientY - rect.top - rect.height / 2) * 0.01);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);


  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden -mt-28 bg-slate-50 dark:bg-slate-900">
      {/* Hero Section */}
      <motion.div
        ref={heroRef}
        style={{ y: heroY }}
        className="relative h-screen flex items-center justify-center overflow-hidden pt-24"
      >
        {/* Atmospheric Background - covers everything */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-950 via-slate-900 to-black z-0" />

        {/* Floating Clouds */}
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            style={{
              opacity: cloudOpacity,
              scale: cloudScale,
              x: springX,
              y: springY,
            }}
            className="absolute z-[5]"
            animate={{
              x: [0, 100, 0],
              y: [0, -30, 0],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <div
              className="w-96 h-96 rounded-full blur-3xl"
              style={{
                background: `radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)`,
                left: `${20 + i * 15}%`,
                top: `${10 + i * 12}%`,
              }}
            />
          </motion.div>
        ))}

        {/* Floating Destination Chips - concentrated in middle/right to avoid text */}
        {destinationChips.slice(0, 12).map((destination, index) => {
          // Position chips more in center-right area (40-90% from left) to avoid main text
          const startLeft = 40 + Math.random() * 50; // 40-90% (middle to right)
          const duration = 15 + Math.random() * 10; // 15-25 seconds
          const delay = index * 1.5; // Staggered start
          
          // Vary opacity and blur for depth - "further back" chips have lower opacity and more blur
          const depthFactor = Math.random(); // 0-1, determines how "back" the chip is
          const opacity = 0.3 + depthFactor * 0.4; // 0.3-0.7
          const blurIntensity = depthFactor < 0.3 ? 'blur-sm' : depthFactor < 0.6 ? 'blur-md' : 'blur-lg'; // More blur for "further back"
          const size = 0.8 + Math.random() * 0.6; // 0.8x to 1.4x scale
          const swayAmplitude = 20 + Math.random() * 30; // 20-50px horizontal sway
          
          return (
            <motion.div
              key={`${destination.name}-${index}`}
              className={`absolute glass-card px-4 py-2 rounded-full backdrop-blur-md border border-slate-200 dark:border-white/20 z-10 ${blurIntensity}`}
              style={{
                left: `${startLeft}%`,
                opacity,
                scale: size,
              }}
              initial={{ y: '100vh', x: 0 }}
              animate={{
                y: '-10vh',
                x: [
                  Math.sin(0) * swayAmplitude,
                  Math.sin(Math.PI) * swayAmplitude,
                  Math.sin(Math.PI * 2) * swayAmplitude,
                ],
              }}
              transition={{
                duration,
                repeat: Infinity,
                ease: 'linear',
                delay,
                x: {
                  duration: duration / 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
            >
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-sm font-medium whitespace-nowrap">
                <span className="text-base">{destination.emoji}</span>
                <span>{destination.name}</span>
              </div>
            </motion.div>
          );
        })}

        {/* Main Content */}
        <motion.div
          className="relative z-30 text-center px-4"
        >
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="text-7xl md:text-9xl font-black text-slate-900 dark:text-white mb-8 tracking-tighter"
          >
            Plan trips together,
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              not alone.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
            className="text-xl md:text-2xl text-slate-700 dark:text-slate-300 mb-12 max-w-2xl mx-auto mt-4"
          >
            Collaborate, discover, and build unforgettable adventures with your group
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, type: 'spring', stiffness: 200 }}
          >
            <Link
              href="/auth"
              className="inline-block px-12 py-6 bg-sky-200 text-slate-900 text-xl font-bold rounded-3xl shadow-2xl shadow-sky-200/60 hover:bg-sky-300 transition-all hover:scale-105 relative overflow-hidden group dark:bg-gradient-to-r dark:from-indigo-600 dark:via-purple-600 dark:to-pink-600 dark:text-white dark:shadow-purple-600/50 dark:hover:shadow-purple-600/70"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{
                  x: ['-100%', '200%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
              <span className="relative z-10 flex items-center gap-3">
                <Sparkles className="w-6 h-6" />
                Start Your Journey
              </span>
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-slate-500 dark:text-white/60"
          >
            <span className="text-sm">Scroll to explore</span>
            <div className="w-6 h-10 border-2 border-slate-400/50 dark:border-white/30 rounded-full flex justify-center">
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 bg-slate-500/70 dark:bg-white/60 rounded-full mt-2"
              />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Transition Section - Clouds Part, Map Appears */}
      <div className="relative h-screen flex items-center justify-center">
        {/* World Map Background (from WorldMapFlashlight) */}
        <motion.div
          style={{ opacity: mapOpacity }}
          className="absolute inset-0 z-0"
        >
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50 dark:opacity-30 brightness-110 saturate-110 dark:brightness-100 dark:saturate-100"
            style={{
              backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg')`,
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(148,163,184,0.2),rgba(226,232,240,0.85)_60%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(15,23,42,0.3),rgba(15,23,42,0.7)_60%)]" />
        </motion.div>

        {/* Feature Cards - Snap together from floating cards */}
        <motion.div
          style={{ y: featuresY }}
          className="relative z-10 container mx-auto px-4 md:px-8 max-w-7xl"
        >
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter">
              Everything you need
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                in one place
              </span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: 'Real-time Collaboration',
                description: 'Plan together with live updates, group chat, and synchronized preferences.',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: Sparkles,
                title: 'AI Discovery',
                description: 'Get personalized recommendations for flights, stays, and activities powered by AI.',
                color: 'from-purple-500 to-pink-500',
              },
              {
                icon: Target,
                title: 'Smart Itinerary',
                description: 'Build day-by-day plans that work for everyone in your group.',
                color: 'from-orange-500 to-red-500',
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.2,
                    type: 'spring',
                    stiffness: 100,
                    damping: 15,
                  }}
                  whileHover={{ scale: 1.05, y: -10 }}
                  className="glass-card rounded-3xl p-8 border border-slate-200 dark:border-white/20 backdrop-blur-xl"
                >
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-center mt-20"
          >
            <Link
              href="/auth"
              className="inline-block px-12 py-6 bg-sky-200 text-slate-900 text-xl font-bold rounded-3xl shadow-2xl shadow-sky-200/60 hover:bg-sky-300 transition-all hover:scale-105 dark:bg-gradient-to-r dark:from-indigo-600 dark:via-purple-600 dark:to-pink-600 dark:text-white dark:shadow-purple-600/50 dark:hover:shadow-purple-600/70"
            >
              Get Started Free
            </Link>
            <p className="text-slate-600 dark:text-slate-400 mt-4">No credit card required</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
