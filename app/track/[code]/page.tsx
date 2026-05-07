export default function TrackPage() {
  return (
    <div className="min-h-screen bg-[#0D2240] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#0D2240] flex items-center justify-center text-3xl mx-auto mb-5">
          🗺️
        </div>
        <h1 className="text-xl font-extrabold text-[#0D2240] mb-2">Live Tracking Coming Soon</h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          Real-time order tracking will be available here shortly.
          In the meantime, contact us for an update on your order.
        </p>
        <a
          href="/"
          className="inline-block mt-6 bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-3 rounded-2xl transition-colors"
        >
          Back to Home
        </a>
      </div>
    </div>
  )
}
