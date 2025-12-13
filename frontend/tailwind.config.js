module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      backgroundImage: {
        'ligand-dark': 'linear-gradient(135deg, #0a0d10, #1a0c1f)',
        'ligand-fucsia': 'linear-gradient(135deg, #0a0d10 0%, #2c0e1f 40%, #ff007a 100%)',
        'ligand-neon': 'linear-gradient(135deg, #0a0d10, #0f1a2b, #1e3a5f)',
        'ligand-smoke': 'linear-gradient(180deg, #0a0d10, #1a0c1f, #2a0f2f)',
        'ligand-focus': 'radial-gradient(circle at center, #1a0c1f, #0a0d10)',
        'ligand-mix-dark': 'linear-gradient(180deg, #0a0d10 0%, #131418 100%)',
        'ligand-mix-violet': 'linear-gradient(90deg, #0a0d10, #17141e, #0a0d10)',
      },
      colors: {
        fucsia: '#ff007a',
        zorrofucsia: '#ff0ea6',
      },
      fontFamily: {
        pacifico: ['Dancing Script', 'cursive'],
      },
      fontSize: {
        '10xl': '10rem',
        '11xl': '12rem',
        '12xl': '14rem',
      },
    },
  },
  plugins: [
    require("tailwind-scrollbar"),
  ],
}
