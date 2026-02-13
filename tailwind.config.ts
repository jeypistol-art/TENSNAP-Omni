import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                mizuho: "#002B6F", // Deep Blue like Mizuho
                accent: "rgba(59, 130, 246, 0.5)", // #3b82f680
            },
        },
    },
    plugins: [],
};
export default config;
