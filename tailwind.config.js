/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/templates/**/*.html',
        './app/static/js/**/*.js',
    ],
    theme: {
        extend: {
            fontFamily: {
                'space-grotesk': ['Space Grotesk', 'sans-serif'],
                'inter': ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                surface: '#0a0a0a',
                card: '#0c0c0c',
                border: '#1c1c1c',
            },
        },
    },
    plugins: [],
};
