"use client"

interface Props {
  groupName: string
  groupId: string
  facilityId: string
  action: (formData: FormData) => Promise<void>
}

export default function DeleteGroupButton({ groupName, groupId, facilityId, action }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="facilityId" value={facilityId} />
      <button
        type="submit"
        className="text-xs text-red-400 hover:text-red-600 transition-colors"
        onClick={(e) => {
          if (!confirm(`Delete group "${groupName}"? This removes all its machines.`)) e.preventDefault()
        }}
      >
        Delete group
      </button>
    </form>
  )
}
