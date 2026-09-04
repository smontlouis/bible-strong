export const DonationStep = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => {
  return (
    <section className="donation-step flex flex-col gap-4 [counter-increment:donation-steps]">
      <h2 className="text-xs font-semibold text-muted-foreground before:mr-2 before:inline-flex before:size-5 before:items-center before:justify-center before:rounded-full before:bg-blue-100 before:text-xs before:font-bold before:text-blue-600 before:content-[counter(donation-steps)]">{label}</h2>
      {children}
    </section>
  )
}
