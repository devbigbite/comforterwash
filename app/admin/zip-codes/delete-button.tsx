"use client"

interface Props {
  zipCode: string
  action: (formData: FormData) => Promise<void>
  id: string
}

export default function DeleteZipButton({ zipCode, action, id }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs text-[#E8726A] hover:text-[#d45f57] underline transition-colors"
        onClick={(e) => {
          if (!confirm(`Remove ZIP ${zipCode}?`)) e.preventDefault()
        }}
      >
        Remove
      </button>
    </form>
  )
}
