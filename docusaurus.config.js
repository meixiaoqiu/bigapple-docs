// @ts-check

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: '大苹果社区',
  tagline: '探索低成本共同生活的开放项目',
  url: 'https://bigapple-docs.vercel.app',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  future: {
    v4: true,
  },

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans', 'en'],
    localeConfigs: {
      'zh-Hans': {
        label: '简体中文',
      },
      en: {
        label: 'English',
      },
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          // 版本管理：当前 docs/ 为最新/下一版本
          // 冻结版本后，最新冻结版本占据 routeBasePath，当前版可通过 /next 访问
          lastVersion: 'current',
          versions: {
            current: {
              label: '下一版本',
              banner: 'unreleased',
            },
          },
        },
        blog: {
          routeBasePath: 'updates',
          blogTitle: '建设动态',
          blogDescription: '大苹果社区建设进展',
          postsPerPage: 10,
          onUntruncatedBlogPosts: 'ignore',
          feedOptions: {
            type: 'all',
            title: '大苹果社区建设动态',
          },
        },
        theme: {},
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: '大苹果社区',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: '社区文档',
          },
          {
            type: 'docSidebar',
            sidebarId: 'liveOsSidebar',
            position: 'left',
            label: 'Live OS',
          },
          {
            type: 'docSidebar',
            sidebarId: 'developerSidebar',
            position: 'left',
            label: '开发者文档',
          },
          {
            to: '/updates',
            position: 'left',
            label: '建设动态',
          },
          {
            type: 'docsVersionDropdown',
            position: 'right',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `Copyright (c) ${new Date().getFullYear()} 大苹果社区贡献者。文档内容与代码按本仓库许可证分别授权。`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
