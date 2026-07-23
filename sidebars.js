// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // ── 主侧边栏：社区介绍、路线图、治理 ──────────────────
  docsSidebar: [
    'index',
    'community-plan',
    {
      type: 'category',
      label: '运行制度',
      link: {type: 'doc', id: 'governance-instruments/index'},
      items: [],
    },
  ],

  // ── Live OS 专用侧边栏 ──────────────────────────────
  liveOsSidebar: [
    'development/page-guide-inventory',
    {
      type: 'category',
      label: 'Observer 公开页面',
      items: [
        'product-pages/observer-dashboard/index',
        'product-pages/observer-events/index',
        'product-pages/observer-finance/index',
        'product-pages/simulation-reports/index',
        'product-pages/mainline/index',
        'product-pages/event-ledger/index',
      ],
    },
    {
      type: 'category',
      label: '社区功能',
      items: [
        'product-pages/feedback/index',
      ],
    },
    {
      type: 'category',
      label: '受保护页面',
      items: [
        'product-pages/workspace-home/index',
        'product-pages/member-application-review/index',
        'product-pages/simulation-lab/index',
      ],
    },
  ],

  // ── 开发者文档专用侧边栏 ──────────────────────────────
  developerSidebar: [
    {
      type: 'category',
      label: '开始开发',
      items: [
        'development/setup',
        'development/remote-dev',
      ],
    },
    'project/overview',
    'project/roadmap',
    {
      type: 'category',
      label: '系统架构',
      items: [
        'architecture/overview',
        'architecture/governance-boundary',
        'architecture/database-schema',
      ],
    },
    {
      type: 'category',
      label: '产品规格',
      items: [
        'project/product-planning',
        'product/member-workspace',
        'product/observer',
        'product/admin',
        'product/simulation',
        'product/project-plan',
      ],
    },
    {
      type: 'category',
      label: '数据库与运行',
      items: [
        'development/world-databases',
        'operations/mysql-migration',
        'operations/runtime-boundary',
      ],
    },
    {
      type: 'category',
      label: '技术契约',
      items: [
        'technical-contracts/overview',
        'technical-contracts/openapi',
        'technical-contracts/schemas',
        'technical-contracts/examples-validation',
        'reference/api',
      ],
    },
    {
      type: 'category',
      label: '仿真开发',
      items: [
        'development/simulation-commands',
      ],
    },
    {
      type: 'category',
      label: '前端与主题',
      items: [
        'development/theme-system',
      ],
    },
    {
      type: 'category',
      label: '文档维护',
      items: [
        'development/page-screenshots',
        'development/docs-maintenance',
      ],
    },
    {
      type: 'category',
      label: 'AI Agent 协作',
      items: [
        'development/ai-guide',
      ],
    },
  ],
};

export default sidebars;
