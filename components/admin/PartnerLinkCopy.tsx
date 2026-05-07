"use client"
import { useState } from "react"

export function PartnerLinkCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
        copied
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {copied ? "✓ Copied" : "Copy Link"}
    </button>
  )
}
