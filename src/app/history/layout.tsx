import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";

export default async function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#f7f5f0] flex flex-col">
      <Nav userName={session.user.name} userEmail={session.user.email} />
      <main className="flex-1 container mx-auto px-6 py-8 max-w-5xl">{children}</main>
      <footer className="bg-[#0f2d1a] text-white/50 text-xs py-4 text-center">
        &copy; {new Date().getFullYear()} Yaba College of Technology &mdash; Academic Integrity Portal &mdash; For authorised staff use only
      </footer>
    </div>
  );
}
