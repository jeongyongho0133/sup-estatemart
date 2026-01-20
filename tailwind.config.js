/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'market-orange': '#ff6f0f', // Carrot Market style orange (or similar friendly color)
                'market-gray': '#f2f3f6', // Light gray background
            }
        },
    },
    plugins: [],
}
