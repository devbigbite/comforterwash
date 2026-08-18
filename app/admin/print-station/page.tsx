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
          One-time setup for the packing-table computer that prints bag receipts on the Bluetooth thermal printer (PX-90B or similar 80mm ESC/POS printer).
          This site talks to the printer directly from the browser — there&apos;s no printer driver to install and no system print dialog involved. Do this once on that machine — it stays configured after.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Quick Links</p>
          <div className="flex flex-wrap gap-2">
            <a href="/operator/owner-login" target="_blank" rel="noopener noreferrer"
              className="bg-[#E8726A] hover:bg-[#d45f57] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              👑 Set Up This Computer as Owner
            </a>
            <a href="/operator/station" target="_blank" rel="noopener noreferrer"
              className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              🖨️ Open Print Station
            </a>
            <a href="/admin" target="_blank" rel="noopener noreferrer"
              className="bg-white border border-gray-200 hover:border-gray-300 text-[#0D2240] text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              Admin Login
            </a>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Part 1 — Pair the Printer</p>

          <Step n={1} title="Turn on the printer and put it in pairing mode">
            <p>Check the printer&apos;s manual — usually holding the power button for a few seconds until an indicator light blinks. This printer uses classic Bluetooth (not Bluetooth Low Energy), so it pairs like a normal Bluetooth accessory, not through the app.</p>
          </Step>

          <Step n={2} title="Pair it at the operating system level">
            <p>Open the packing-station computer&apos;s Bluetooth settings (Windows: Settings → Bluetooth & devices; Mac: System Settings → Bluetooth) and pair the printer like any other Bluetooth device.</p>
            <p>Once paired, the OS exposes it as a virtual COM/serial port — that&apos;s expected, and it&apos;s exactly what the browser will connect to in Part 2. You do <strong>not</strong> need to install it as a system printer, and there is no driver to download.</p>
          </Step>

          <Step n={3} title="Load the paper correctly">
            <p>Use the plain 80mm thermal receipt roll (not a die-cut label roll). Load it so the thermal-sensitive side faces the print head — if a test print comes out blank, the roll is in backwards, just flip it.</p>
          </Step>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Part 2 — Set Up the Browser Session</p>

          <Step n={1} title="Log into Admin on this computer">
            <p>Go to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">comforterwash.com/admin</code> and log in with the admin password once. This just needs to happen once per browser.</p>
          </Step>

          <Step n={2} title="Set this computer up as Owner">
            <p>Click the <strong>&quot;👑 Set Up This Computer as Owner&quot;</strong> button above (only works while you&apos;re logged into Admin, which you already are). It signs this browser into the Operator app as Owner and drops you straight into the Print Station.</p>
            <p>This matters because Owner sessions can see and print <strong>any</strong> operator&apos;s finished order, not just orders assigned to one specific worker. It also stays logged in permanently on this browser afterward — you will not need to repeat this step after restarts, and you won&apos;t need a worker PIN at all on this machine.</p>
          </Step>

          <Step n={3} title="Go to the Print Station and pin it">
            <p>Navigate to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">comforterwash.com/operator/station</code> — this is the screen that should stay open on this computer permanently.</p>
            <p>Set it as the browser&apos;s home page, or just leave the tab open and never close it. Consider disabling sleep/screen-lock on this machine so it&apos;s always ready.</p>
          </Step>

          <Step n={4} title="Connect to the printer from the browser — once">
            <p>The first time you print a receipt, the page shows a <strong>&quot;🔗 Connect via Serial/COM Port&quot;</strong> button. Click it and pick the printer from the list Chrome/Edge shows (it will appear as a COM port, not by brand name, since it was paired at the OS level in Part 1).</p>
            <p>Use Chrome or Edge on desktop — this direct-connect feature (Web Serial) isn&apos;t available in Safari or Firefox. Once granted, the browser remembers this printer and reconnects automatically on future visits — no need to pick it again.</p>
            <p>If this specific unit turns out to support Bluetooth Low Energy instead, there&apos;s a <strong>&quot;Try Bluetooth (BLE) instead&quot;</strong> link as a fallback — most operators won&apos;t need it.</p>
          </Step>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Part 3 — Daily Use</p>
          <div className="text-gray-500 text-sm leading-relaxed space-y-3">
            <p>As soon as an order is confirmed and assigned — before pickup even happens — it automatically appears on the Print Station&apos;s <strong>&quot;To Print&quot;</strong> tab — big order code, bag count, one Print button. Printing happens at the start of the process now, not after packing, so the Floor vs. Storage decision hasn&apos;t been made yet at this point; that&apos;s decided later in the order app and doesn&apos;t block printing. The list refreshes on its own every 15 seconds, so nothing needs to be manually pulled up.</p>
            <p>Tapping <strong>Print</strong> sends the receipt(s) straight to the printer over the connection made in Part 2 — one receipt per packed bag, with the logo, order code, delivery address, color key sticker to use (by name, since the printer is monochrome), wash preferences, and the due date. No price or extra customer info is printed. There is no print dialog to interact with — receipts start printing within a second or two of tapping the button.</p>
            <p>If a receipt gets lost, jammed, or needs a reprint, switch to the <strong>&quot;🔁 Already Printed&quot;</strong> tab — it lists the last 50 printed orders with a one-tap Reprint button. Reprinting doesn&apos;t affect the original print record.</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Troubleshooting</p>
          <div className="text-amber-700 text-sm leading-relaxed space-y-1.5">
            <p>• <strong>Printer doesn&apos;t show up in the connect picker:</strong> make sure it&apos;s paired at the OS level first (Part 1, Step 2) — the browser can only see devices/ports the operating system already knows about.</p>
            <p>• <strong>Nothing happens when you click Print:</strong> the connection may have dropped — refresh the page and reconnect via the &quot;Connect via Serial/COM Port&quot; button.</p>
            <p>• <strong>Printing failed / garbled output:</strong> the printer may be low on battery or out of range — check it&apos;s powered on and close to the computer, then try again.</p>
            <p>• <strong>Receipt prints blank or faint:</strong> the paper roll is likely loaded backwards — flip it so the thermal-coated side faces the print head.</p>
            <p>• <strong>Using Safari or Firefox:</strong> switch to Chrome or Edge — direct printer connections require Web Serial/Web Bluetooth support that those two browsers don&apos;t have.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
