/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['SF Pro Display', 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 32px 80px rgba(15, 23, 42, 0.20)',
      },
      colors: {
        ink: '#0b1220',
      },
      backgroundImage: {
        hero: 'radial-gradient(1300px 560px at -8% -12%, rgba(126,34,206,.20), transparent 60%), radial-gradient(980px 500px at 106% -12%, rgba(14,165,233,.25), transparent 58%), radial-gradient(880px 520px at 50% 118%, rgba(16,185,129,.18), transparent 60%), linear-gradient(180deg, #eff4ff 0%, #e8eefb 42%, #e5ecf8 100%)',
      },
    },
  },
  plugins: [],
};
