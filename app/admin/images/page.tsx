import { getSiteImages } from "@/app/actions/settings"
import { SiteImagesEditor } from "@/components/admin/site-images-editor"

export const metadata = { title: "Site Images — Admin" }

export default async function AdminImagesPage() {
  const images = await getSiteImages()

  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-[#0D2240] mb-1">Site Images</h1>
          <p className="text-sm text-gray-400">
            Upload custom photos for each section of the homepage. Images go live immediately.
          </p>
        </div>

        <SiteImagesEditor initialImages={images} />
      </div>
    </main>
  )
}
