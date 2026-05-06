import { getSiteImages, getSiteText } from "@/app/actions/settings"
import { SiteImagesEditor } from "@/components/admin/site-images-editor"

export const metadata = { title: "Site Images — Admin" }

export default async function AdminImagesPage() {
  const [images, text] = await Promise.all([getSiteImages(), getSiteText()])

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0D2240] mb-1">Site Images</h1>
        <p className="text-sm text-gray-400">
          Upload photos and edit text for each section of the homepage. Changes go live immediately.
        </p>
      </div>
      <SiteImagesEditor initialImages={images} initialText={text} />
    </div>
  )
}
