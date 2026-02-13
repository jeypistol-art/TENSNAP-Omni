import Link from "next/link";

export default function LegalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <header className="border-b border-border py-4 px-6 fixed w-full bg-background/80 backdrop-blur-md z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold text-mizuho dark:text-blue-400">
                        TENsNAP・Omni
                    </Link>
                    <nav>
                        <Link
                            href="/"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Back to Home
                        </Link>
                    </nav>
                </div>
            </header>
            <main className="flex-grow pt-24 pb-12 px-6">
                <div className="max-w-3xl mx-auto prose dark:prose-invert">
                    {children}
                </div>
            </main>
            <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} TENsNAP・Omni. All rights reserved.
            </footer>
        </div>
    );
}
