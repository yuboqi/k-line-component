import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: './tsconfig.app.json',
      outDir: 'dist',
      include: ['src/kline/**/*.ts', 'src/kline/**/*.tsx'],
    }),
  ],
  build: {
    sourcemap: true,
    lib: {
      entry: 'src/kline/index.ts',
      name: 'KLineComponent',
      formats: ['es', 'cjs'],
      fileName: (format) => `kline-component.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
})
