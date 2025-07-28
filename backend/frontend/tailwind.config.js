module.exports = {
  content: [
    './*.html',              // root HTML files
    './js/**/*.js',          // your JS folder (adjust to actual location)
    './components/**/*.js',  // if you use component folders
  ],
  safelist: [
    'bg-[#34a853]',
    'bg-[#fbbc05]',
    'bg-[#4285f4]',
    'bg-[#eb4335]',
    'text-white',
    'text-[#1e1e1e]',
    'text-[#ebffee]',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
