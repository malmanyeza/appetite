/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0F0F0F",
                accent: "#FF4D00",
                light: {
                    bg: "#FFFFFF",
                    surface: "#F6F6F6",
                },
                muted: "#A3A3A3",
            },
            borderRadius: {
                'xl': '12px',
                '2xl': '16px',
            }
        },
    },
    plugins: [],
}
