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
            gridTemplateColumns: {
                '13': 'repeat(13, minmax(0, 1fr))',
                '14': 'repeat(14, minmax(0, 1fr))',
                '15': 'repeat(15, minmax(0, 1fr))',
                '16': 'repeat(16, minmax(0, 1fr))',
                '18': 'repeat(18, minmax(0, 1fr))',
                '20': 'repeat(20, minmax(0, 1fr))',
                '24': 'repeat(24, minmax(0, 1fr))',
                '30': 'repeat(30, minmax(0, 1fr))',
            },
            keyframes: {
                'pulse-red-bg': {
                    '0%, 100%': { backgroundColor: '#161616', borderColor: '#ef4444' },
                    '50%': { backgroundColor: '#7f1d1d', borderColor: '#b91c1c' },
                }
            },
            animation: {
                'pulse-red-bg': 'pulse-red-bg 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        },
    },
    plugins: [],
};
