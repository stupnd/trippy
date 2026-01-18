'use client';

export default function WorldMapFlashlight() {
  return (
    <div className="fixed inset-0 -z-20 pointer-events-none">
      {/* World Map Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60 brightness-110 saturate-110 dark:opacity-30 dark:brightness-100 dark:saturate-100"
        style={{
          backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg')`,
        }}
      />
      {/* Subtle overlay to keep content readable */}
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.5),rgba(255,255,255,0.85)_60%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(15,23,42,0.3),rgba(15,23,42,0.7)_60%)]"
      />
    </div>
  );
}
