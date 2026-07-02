/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/templates/**/*.html',
        './app/static/js/**/*.js',
    ],
    theme: {
        extend: {
            fontFamily: {
                'inter': ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                surface: '#0a0a0a',
                card: '#0c0c0c',
                border: '#1c1c1c',
                'surface-card': '#1c1c1e',
                'surface-hover': '#2a2a2a',
                'accent-green': '#00d4a4',
                'accent-green-hover': '#00b48a',
                'accent-red': '#d45656',
                'accent-amber': '#c37d0d',
            },
        },
    },
    plugins: [],
};
