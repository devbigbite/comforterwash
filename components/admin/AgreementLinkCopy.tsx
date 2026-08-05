"use client"
import { useState } from "react"

export function AgreementLinkCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="flex items-center gap-2 bg-[#f7f8fb] rounded-xl px-3 py-2 border border-gray-100">
      <span className="text-xs text-gray-400 font-mono truncate flex-1">{url}</span>
      <button
        type="button"
        onClick={copy}
        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all shrink-0 ${
          copied ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
      >
        {copied ? "✓ Copied" : "Copy Agreement Link"}
      </button>
    </div>
  )
}
