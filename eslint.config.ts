import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'app',
  typescript: true,
  // Keep the initial shell on the core preset; enable React-specific
  // integration once the component surface has stabilized.
  // 初始外壳保持核心预设; 组件面稳定后再启用 React 集成。
  react: false,
  stylistic: true,
  formatters: false,
  ignores: [
    '**/dist/**',
    '**/target/**',
    '**/runtime/**',
    '**/node_modules/**',
    '**/.agents/**',
    'src-tauri/gen/**',
  ],
})
