import Link from "next/link"

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-8 h-8 rounded-full bg-[#0D2240] text-white font-extrabold text-sm flex items-center justify-center">
        {n}
      </div>
      <div className="pb-6 border-l border-gray-100 pl-4 -ml-4">
        <p className="font-bold text-[#0D2240] text-base mb-1">{title}</p>
        <div className="text-gray-500 text-sm leading-relaxed space-y-2">{children}</div>
      </div>
    </div>
  )
}

export default function PrintStationSetupPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin" className="text-sm text-gray-400 hover:text-[#0D2240]">← Control Panel</Link>

        <h1 className="text-2xl font-extrabold text-[#0D2240] mt-3">Print Station Setup</h1>
        <p className="text-gray-500 text-sm mt-1 mb-8">
          One-time setup for the packing-table computer that prints bag receipts on the thermal printer (Munbyn or any Bluetooth thermal receipt printer). Do this once on that machine — it stays configured after.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Quick Links</p>
          <div className="flex flex-wrap gap-2">
            <a href="/operator/station" target="_blank" rel="noopener noreferrer"
              className="bg-[#E8726A] hover:bg-[#d45f57] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              🖨️ Open Print Station
            </a>
            <a href="/operator" target="_blank" rel="noopener noreferrer"
              className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              Open Operator App
            </a>
            <a href="/admin" target="_blank" rel="noopener noreferrer"
              className="bg-white border border-gray-200 hover:border-gray-300 text-[#0D2240] text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              Admin Login
            </a>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Part 1 — Connect the Printer</p>

          <Step n={1} title="Pair or plug in the printer">
            <p><strong>USB (recommended if possible):</strong> plug the printer into the packing-station computer directly. Windows/Mac will usually install a driver automatically or prompt you to download one from Munbyn's site.</p>
            <p><strong>Bluetooth:</strong> put the printer in pairing mode (check its manual — usually holding the power button), then go to the computer's Bluetooth settings and pair it like any Bluetooth device. Once paired, it should show up as an available printer.</p>
          </Step>

          <Step n={2} title="Confirm it shows up as a system printer">
            <p>Open the computer's Printers & Scanners settings (Windows) or Printers (Mac) and confirm the thermal printer is listed and shows as "Ready" or "Idle" — not "Offline."</p>
            <p>If it doesn't appear, install Munbyn's driver/utility from their support site — this is what registers it as a normal printer the browser can print to.</p>
          </Step>

          <Step n={3} title="Load the paper correctly">
            <p>Use the plain 80mm thermal receipt roll (not the die-cut label roll with terms of service printed on the back). Load it so the thermal-sensitive side faces the print head — if a test print comes out blank, the roll is in backwards, just flip it.</p>
          </Step>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Part 2 — Set Up the Browser Session</p>

          <Step n={1} title="Log into Admin on this computer">
            <p>Go to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">comforterwash.com/admin</code> and log in with the admin password once. This just needs to happen once per browser.</p>
          </Step>

          <Step n={2} title="Open the Operator app and continue as Owner">
            <p>Go to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">comforterwash.com/operator</code> — you'll see a "Continue as Owner" option since you're logged into admin. Tap it once.</p>
            <p>This matters because Owner sessions can see and print <strong>any</strong> operator's finished order, not just orders assigned to one specific worker. It also now stays logged in permanently on this browser — you will not need to repeat this step after restarts.</p>
          </Step>

          <Step n={3} title="Go to the Print Station and pin it">
            <p>Navigate to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">comforterwash.com/operator/station</code> — this is the screen that should stay open on this computer permanently.</p>
            <p>Set it as the browser's home page, or just leave the tab open and never close it. Consider disabling sleep/screen-lock on this machine so it's always ready.</p>
          </Step>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Part 3 — Daily Use</p>
          <div className="text-gray-500 text-sm leading-relaxed space-y-3">
            <p>Once an operator finishes packing an order (Floor vs. Storage decided in the order app), it automatically appears on the Print Station's <strong>"To Print"</strong> tab — big order code, bag count, one Print button. The list refreshes on its own every 15 seconds, so nothing needs to be manually pulled up.</p>
            <p>Tapping <strong>Print</strong> opens the receipts and fires the print dialog automatically — one receipt per packed bag, showing the order code, delivery address, color key sticker to use (by name, since the printer is monochrome), the yellow storage-marker reminder if applicable, wash preferences, and the due date. No price or extra customer info is printed.</p>
            <p>If a receipt gets lost, jammed, or needs a reprint, switch to the <strong>"🔁 Already Printed"</strong> tab — it lists the last 50 printed orders with a one-tap Reprint button. Reprinting doesn't affect the original print record.</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Troubleshooting</p>
          <div className="text-amber-700 text-sm leading-relaxed space-y-1.5">
            <p>• <strong>Print dialog doesn't open automatically:</strong> browser pop-up/auto-print blockers can interfere — allow pop-ups for this site, or just click "Print All Receipts" manually on the receipts page.</p>
            <p>• <strong>Wrong printer selected in the dialog:</strong> the browser may default to a different printer (like "Save as PDF") — set the thermal printer as the default printer in system settings so it's pre-selected.</p>
            <p>• <strong>"Continue as Owner" isn't showing up:</strong> the admin login session may have expired — log into /admin again, then return to /operator.</p>
            <p>• <strong>Receipt prints blank or faint:</strong> the paper roll is likely loaded backwards — flip it so the thermal-coated side faces the print head.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
