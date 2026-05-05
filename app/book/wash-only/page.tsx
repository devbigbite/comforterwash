import { WashOnlyForm } from "@/components/wash-only-form"
import { LangToggle } from "@/components/lang-toggle"
import Link from "next/link"

export const metadata = {
  title: "Book Wash Only — WashFold Orlando",
  description: "Clothes washed and returned clean in a bag. $1.99/lb, 20 lb minimum.",
}

export default function WashOnlyPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#0D2240] font-extrabold text-lg">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="24" fill="#0D2240" />
              <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
                stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
            Wash<span className="text-[#E8726A]">Fold</span>
          </Link>
          <div className="flex items-center gap-4">
            <LangToggle variant="light" />
            <Link href="/" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
              ← All Services
            </Link>
          </div>
        </div>
      </header>

      <div className="bg-[#0D2240] py-8 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-3">
          <span className="text-2xl">🧺</span>
          <span className="text-white font-bold text-sm">Wash Only</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Schedule Your Pickup</h1>
        <p className="text-white/60 text-sm">$1.99/lb · 20 lb minimum · Returned clean, unfolded</p>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-700">
          <strong>What is Wash Only?</strong> Your clothes are washed and dried using your preferred detergent, then returned clean in the bag — unfolded.