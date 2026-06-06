export default function HudOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-[#00FFFF]/20" />
      <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-[#00FFFF]/20" />
      <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-[#00FFFF]/20" />
      <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-[#00FFFF]/20" />
    </div>
  )
}
