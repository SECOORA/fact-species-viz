const colors = require('tailwindcss/colors');

module.exports = {
  prefix: 'tw-',
  important: '#app',
  future: {
    removeDeprecatedGapUtilities: true,
  },
  purge: false,
  theme: {
    extend: {},
    colors: {
      transparent: "transparent",
      current: "currentColor",
      black: colors.black,
      white: colors.white,
      gray: colors.trueGray,
      indigo: colors.indigo,
      red: colors.rose,
      yellow: colors.amber,
      orange: colors.orange,
    },
    fontSize: {
      xs: ".75em",
      sm: ".875em",
      base: "16px",
      lg: "1.125em",
      xl: "1.25em",
      "2xl": "1.5em",
      "3xl": "1.875em",
      "4xl": "2.25em",
      "5xl": "3em",
      "6xl": "4em",
      "7xl": "5em",
    },
  },
  variants: {
    extend: {
      display: ["group-hover"],
      fontSize: ["hover"],
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
