export default function StartSuccessPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center px-4">
      <div className="max-w-md text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="text-4xl mb-4">✓</div>
        <h1 className="text-xl font-extrabold text-[#0D2240] mb-2">You&apos;re in!</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Check your email for a link to sign in to your new admin dashboard — it should land within a couple of
          minutes. Your free trial has started, nothing else to do right now.
        </p>
      </div>
    </div>
  )
}
