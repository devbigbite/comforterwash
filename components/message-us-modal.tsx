"use client"

import { useRef, useState, useTransition } from "react"
import { sendContactMessage } from "@/app/actions/contact"

export function MessageUsModal({ label = "Message Us", className = "" }: { label?: string; className?: string }) {
  const [open, setOpen]       = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState("")
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await sendContactMessage(fd)
      if (res?.error) { setError(res.error) }
      else { setDone(true); formRef.current?.reset() }
    })
  }

  function handleClose() { setOpen(false); setTimeout(() => setDone(false), 300) }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={handleClose}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative" onClick={e => e.stopPropagation()}>
            <button onClick={handleClose} className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors text-2xl leading-none">&times;</button>

            {done ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[#0D2240] font-extrabold text-xl mb-2">Message Sent!</p>
                <p className="text-gray-400 text-sm mb-6">We'll get back to you shortly.</p>
                <button onClick={handleClose} className="bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3 rounded-full transition-colors">
                  Close
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-[#0D2240] font-extrabold text-2xl mb-1">Message Us</h2>
                <p className="text-gray-400 text-sm mb-6">We'll reply as soon as possible.</p>

                <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Your Name <span className="text-[#E8726A]">*</span></label>
                    <input
                      name="name" required
                      placeholder="Jane Smith"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/40 focus:border-[#E8726A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Phone Number</label>
                    <input
                      name="phone" type="tel"
                      placeholder="(407) 555-0100"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/40 focus:border-[#E8726A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
                    <input
                      name="email" type="email"
                      placeholder="jane@example.com"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/40 focus:border-[#E8726A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Message <span className="text-[#E8726A]">*</span></label>
                    <textarea
                      name="message" required rows={4}
                      placeholder="How can we help you?"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#E8726A]/40 focus:border-[#E8726A]"
                    />
                  </div>

                  {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

                  <button
                    type="submit" disabled={pending}
                    className="bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-60 text-white font-bold text-sm px-8 py-3.5 rounded-full transition-colors w-full mt-1"
                  >
                    {pending ? "Sending…" : "Send Message"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
