# 前端项目架构约束

## 技术栈
- React 18 + TypeScript
- TanStack Query
- Tailwind CSS

## 架构原则

### 1. 组件设计
- 单一职责：每个组件只做一件事
- 组合优于继承：使用 props.children 和 render props
- 受控组件优先

### 2. 状态管理
- 本地状态：useState
- 服务端状态：TanStack Query
- 全局状态：Context API 或 Zustand

### 3. 样式规范
- 使用 Tailwind CSS 工具类
- 复杂组件使用 CSS Modules 或 styled-components
- 遵循设计系统的间距、颜色规范

### 4. 文件组织
```
src/
├── components/  # 通用组件
├── pages/       # 页面组件
├── hooks/       # 自定义 Hooks
├── api/         # API 客户端
├── types/       # 类型定义
└── utils/       # 工具函数
```

## 禁止事项
- 禁止在 useEffect 中直接修改状态
- 禁止使用 any 类型
- 禁止在组件中直接调用浏览器 API（通过 hooks 封装）
