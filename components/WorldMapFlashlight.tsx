'use client';

export default function WorldMapFlashlight() {
  return (
    <div className="fixed inset-0 -z-20 pointer-events-none">
      {/* World Map Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg')`,
        }}
      />
    </div>
  );
}
