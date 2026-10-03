// The esbuild settings every bundle of the library's source needs, shared by the build
// (scripts/build.mjs), the size report (scripts/measure-sizes.mjs) and the licence test.

export const SOURCE_OPTIONS = {
  define: { 'process.env.NODE_ENV': '"production"' },
};

export const SOURCE_PLUGINS = [];
