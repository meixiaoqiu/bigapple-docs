// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // ── 主侧边栏：社区介绍、路线图、治理 ──────────────────
  docsSidebar: [
    'index',
    {
      type: 'category',
      label: '术语与概念',
      link: {type: 'doc', id: 'terminology/index'},
      items: [
        'terminology/big-apple-community',
        'terminology/free-living',
        'terminology/covenant-keeper',
      ],
    },
    {
      type: 'category',
      label: '运行制度',
      link: {type: 'doc', id: 'governance-instruments/index'},
      items: [],
    },
  ],

  // ── 建设计划专用侧边栏 ──────────────────────────────
  planSidebar: [
    {
      type: 'doc',
      id: 'plan/index',
      label: '建设计划',
    },
    {
      type: 'doc',
      id: 'plan/company-formation',
      label: '公司设立计划',
    },
    {
      type: 'doc',
      id: 'plan/first-campus',
      label: '首个园区分期建设方案',
    },
    {
      type: 'doc',
      id: 'plan/cost-estimate',
      label: '建设成本测算报告',
    },
    {
      type: 'doc',
      id: 'plan/site-due-diligence',
      label: '候选场地尽调与签约准入标准',
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
    {
      type: 'doc',
      id: 'project/roadmap',
      label: 'Live OS 产品路线图',
    },
    {
      type: 'category',
      label: '系统架构',
      items: [
        'architecture/overview',
        'architecture/governance-boundary',
        'development/role-permission-acceptance',
        'architecture/database-schema',
      ],
    },
    {
      type: 'category',
      label: '产品规格',
      items: [
        {
          type: 'doc',
          id: 'project/product-planning',
          label: 'Live OS 产品规划',
        },
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
