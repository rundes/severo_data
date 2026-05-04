import ElectoralContent from "@/components/dashboard/ElectoralContent"

export default function ElectoralPage() {
  const folderId =
    process.env.NEXT_PUBLIC_ELECTORAL_FOLDER_ID ?? "1_U1H9h8YillNmDAEXCikQBwlxQCUZRkU"

  return <ElectoralContent folderId={folderId} />
}
