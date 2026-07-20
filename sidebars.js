// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'index',
    {
      type: 'category',
      label: '项目',
      link: {type: 'doc', id: 'project/overview'},
      items: ['project/product-planning', 'project/roadmap'],
    },
    {
      type: 'category',
      label: '架构',
      link: {type: 'doc', id: 'architecture/overview'},
      items: [],
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
      items: [],
    },
  ],
};

export default sidebars;
