import { BookingForm } from "@/components/booking-form"
import Image from "next/image"

function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="20" fill="#1e40af" />
      <path
        d="M7 20.5 Q10.5 15 14 20.5 Q17.5 26 21 20.5 Q24.5 15 28 20.5 Q29.5 23 31 20.5"
        stroke="#67e8f9"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9 25.5 Q12.5 20 16 25.5 Q19.5 31 23 25.5 Q26.5 20 30 25.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      <line x1="31" y1="8.5" x2="31" y2="13.5" stroke="#67e8f9" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="28.5" y1="11" x2="33.5" y2="11" stroke="#67e8f9" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="29.3" y1="9.3" x2="32.7" y2="12.7" stroke="#67e8f9" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="32.7" y1="9.3" x2="29.3" y2="12.7" stroke="#67e8f9" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white">

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-[#1e3a8a]/95 backdrop-blur-sm shadow-md">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark size={34} />
            <span className="text-white font-extrabold text-xl tracking-tight">
              Wash<span className="text-[#67e8f9]">Fold</span>
              <span className="ml-1.5 text-white/50 text-xs font-semibold uppercase tracking-widest hidden sm:inline">
                Orlando
              </span>
            </span>
          </div>
          <a
            href="#book"
            className="bg-[#67e8f9] text-[#1e3a8a] font-bold text-sm px-5 py-2.5 rounded-full hover:bg-white transition-colors whitespace-nowrap"
          >
            Book Now
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f2057] via-[#1e3a8a] to-[#1d4ed8] px-4 pt-14 pb-40">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-8">
            <span className="text-[#fbbf24] text-sm tracking-widest">★★★★★</span>
            <span className="text-white/80 text-sm">
              Trusted by <strong className="text-white">500+ Orlando families</strong>
            </span>
          </div>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                Your Comforter,<br />
                <span className="text-[#67e8f9]">Washed &amp; Delivered</span><br />
                <span className="text-white/75">Back to Your Door.</span>
              </h1>
              <p className="text-white/70 text-xl mb-8 leading-relaxed max-w-md">
                Free pickup &amp; delivery in Orlando. Professional wash in 72 hours.{" "}
                <span className="text-white font-semibold">$29 flat — any size.</span>
              </p>
              <div className="flex flex-wrap gap-2.5 mb-10">
                {[
                  "✓  Free Pickup & Delivery",
                  "✓  72-Hour Turnaround",
                  "✓  $29 Any Size",
                  "✓  Live SMS Updates",
                ].map((b) => (
                  <span
                    key={b}
                    className="bg-white/10 text-white/85 text-sm px-4 py-1.5 rounded-full font-medium border border-white/10"
                  >
                    {b}
                  </span>
                ))}
              </div>
              <a
                href="#book"
                className="inline-flex items-center gap-2 bg-[#67e8f9] text-[#1e3a8a] font-extrabold text-lg px-8 py-4 rounded-2xl hover:bg-white transition-all shadow-xl shadow-black/20"
              >
                Schedule My Pickup &#8594;
              </a>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="relative w-full max-w-md">
                <div className="absolute -inset-8 bg-[#67e8f9]/10 rounded-3xl blur-3xl" />
                <Image
                  src="/sweet-sleep.jpg"
                  alt="Person sleeping on fresh clean comforter"
                  width={560}
                  height={420}
                  className="relative rounded-2xl shadow-2xl w-full object-cover"
                  priority
                />
                <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl px-5 py-3 shadow-2xl border border-gray-100">
                  <p className="text-3xl font-extrabold text-[#1e3a8a] leading-none">$29</p>
                  <p className="text-xs font-bold text-[#67e8f9] uppercase tracking-wider mt-0.5">Any Size</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path
              d="M0 100L60 87C120 74 240 48 360 39C480 30 600 39 720 45C840 51 960 54 1080 49C1200 44 1320 31 1380 24L1440 17V100H0Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-16 bg-white">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold text-[#1e3a8a] mb-2">How It Works</h2>
          <p className="text-gray-400 mb-12 text-xs uppercase tracking-widest font-semibold">
            Three steps, zero hassle
          </p>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {[
              { n: "01", emoji: "📅", title: "Book Online", desc: "Choose your pickup date and how many comforters — takes under 2 minutes." },
              { n: "02", emoji: "🚚", title: "We Pick Up", desc: "Our team comes to your door Mon–Wed in your chosen time window." },
              { n: "03", emoji: "✨", title: "Delivered Fresh", desc: "72 hours later, your comforter is clean, bagged, and back at your door." },
            ].map((s) => (
              <div key={s.n} className="flex flex-col items-center gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1e3a8a]/10 to-[#67e8f9]/20 flex items-center justify-center text-3xl shadow-sm">
                  {s.emoji}
                </div>
                <span className="text-[10px] font-bold text-[#67e8f9] uppercase tracking-[0.2em]">{s.n}</span>
                <h3 className="font-extrabold text-[#1e3a8a]">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="bg-[#f0f6ff] px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: "🛡️", label: "Insured Service" },
              { icon: "♻️", label: "Eco-Friendly Wash" },
              { icon: "🎁", label: "Free Comforter Bag" },
              { icon: "💬", label: "Real-Time SMS" },
            ].map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-2 bg-white rounded-2xl p-5 shadow-sm text-center">
                <span className="text-2xl">{t.icon}</span>
                <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wide">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Booking Form */}
      <section id="book" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-extrabold text-[#1e3a8a]">Schedule Your Pickup</h2>
            <p className="mt-2 text-gray-400 text-sm">
              Mon–Wed pickup &amp; delivery · 72-hour turnaround · $29 per comforter
            </p>
          </div>
          <BookingForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f2057] px-4 py-10">
        <div className="mx-auto max-w-6xl text-center">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <LogoMark size={28} />
            <span className="text-white font-extrabold text-lg tracking-tight">
              Wash<span className="text-[#67e8f9]">Fold</span>{" "}
              <span className="text-white/30 text-sm font-normal">Orlando</span>
            </span>
          </div>
          <p className="text-white/25 text-xs">
            &copy; {new Date().getFullYear()} WashFold Orlando. All rights reserved.
          </p>
        </div>
      </footer>

    </main>
  )
}
