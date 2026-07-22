// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'index',
    {
      type: 'category',
      label: '认识大苹果',
      link: {type: 'doc', id: 'project/overview'},
      items: ['project/product-planning'],
    },
    {
      type: 'category',
      label: '建设计划',
      link: {type: 'doc', id: 'project/roadmap'},
      items: [],
    },
    {
      type: 'category',
      label: '运行制度',
      link: {type: 'doc', id: 'governance-instruments/index'},
      items: [],
    },
    {
      type: 'category',
      label: '公开与透明',
      link: {type: 'doc', id: 'technical-contracts/overview'},
      items: [
        'technical-contracts/openapi',
        'technical-contracts/schemas',
        'technical-contracts/examples-validation',
      ],
    },
    {
      type: 'category',
      label: '参与建设',
      items: [
        {
          type: 'category',
          label: '架构',
          link: {type: 'doc', id: 'architecture/overview'},
          items: ['architecture/governance-boundary', 'architecture/database-schema'],
        },
        {
          type: 'category',
          label: '产品功能',
          items: [
            'product/member-workspace',
            'product/observer',
            'product/admin',
            'product/simulation',
            'product/project-plan',
          ],
        },
        {
          type: 'category',
          label: '运行',
          link: {type: 'doc', id: 'operations/runtime-boundary'},
          items: ['operations/mysql-migration'],
        },
        {
          type: 'category',
          label: '开发',
          items: [
            'development/setup',
            'development/world-databases',
            'development/simulation-commands',
            'development/ai-guide',
            'development/theme-system',
            'development/remote-dev',
            'development/docs-maintenance',
          ],
        },
        {
          type: 'category',
          label: '参考',
          items: ['reference/api'],
        },
      ],
    },
  ],
};

export default sidebars;
