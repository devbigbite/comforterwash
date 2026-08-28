import { ChangePasswordForm } from "./change-password-form"

export default function SettingsPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold text-[#1e3a8a] mb-1">Account</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your own sign-in details.</p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Change password</h2>
        <p className="text-gray-400 text-sm mb-5">
          Set a new password for your own account. This doesn&apos;t affect anyone else&apos;s login.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  )
}
