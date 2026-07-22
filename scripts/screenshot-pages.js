/**
 * 页面自动截图脚本（支持登录态）
 *
 * 使用方式：
 *   npm run capture:screenshots [-- --help] [-- --list] [-- --auth <name>] [-- --id <id>]
 *
 * 环境变量：
 *   实际地址和凭据从 .env.screenshots 或终端环境变量读取，不写入 manifest 或脚本。
 *
 * 页面配置：
 *   所有任务定义在项目根目录的 screenshot-manifest.json。
 */

const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('node:util');

// ── 加载 .env.screenshots（不覆盖已有环境变量）───────

const ROOT_DIR = path.resolve(__dirname, '..');
const DOTENV_PATH = path.join(ROOT_DIR, '.env.screenshots');

if (fs.existsSync(DOTENV_PATH)) {
  // dotenv 默认不覆盖已存在的 process.env
  const dotenv = require('dotenv');
  const result = dotenv.config({ path: DOTENV_PATH, override: false, quiet: true });
  if (result.error) {
    console.error(`[错误] .env.screenshots 解析失败: ${result.error.message}`);
    process.exit(1);
  }
} else {
  console.log('[提示] .env.screenshots 未找到，将仅使用终端环境变量。');
}

// ── 常量 ──────────────────────────────────────────────

const MANIFEST_PATH = path.join(ROOT_DIR, 'screenshot-manifest.json');
const VIEWPORT = { width: 1440, height: 900 };
const DEVICE_SCALE_FACTOR = 1;
const LOGIN_PAGE_TITLE = '登录账号';

// ── CLI 参数解析 ──────────────────────────────────────

function parseCliArgs() {
  try {
    const { values } = parseArgs({
      options: {
        help:     { type: 'boolean', short: 'h' },
        list:     { type: 'boolean' },
        auth:     { type: 'string' },
        id:       { type: 'string', multiple: true },
      },
      allowPositionals: false,
    });
    return values;
  } catch (err) {
    console.error(`[错误] 命令行参数解析失败: ${err.message}`);
    showHelp();
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
页面自动截图脚本

用法:
  npm run capture:screenshots [-- <选项>]

选项:
  --help, -h       显示帮助
  --list           列出所有截图任务（不启动浏览器，不需要凭据）
  --auth <name>    只执行指定认证身份的页面 (public|member|governance|superuser)
  --id <id>        只执行指定任务 ID（可多次使用）

示例:
  npm run capture:screenshots -- --list
  npm run capture:screenshots -- --auth public
  npm run capture:screenshots -- --id feedback --id mainline
  npm run capture:screenshots

环境变量:
  SCREENSHOT_BASE_URL             公开页面、成员页面和治理页面的入口
  SCREENSHOT_ADMIN_BASE_URL       管理后台入口（可与 SCREENSHOT_BASE_URL 相同）
  DOCS_SCREENSHOT_MEMBER_LOGIN    普通成员账号
  DOCS_SCREENSHOT_MEMBER_PASSWORD 普通成员密码
  DOCS_SCREENSHOT_GOVERNANCE_LOGIN    治理成员账号
  DOCS_SCREENSHOT_GOVERNANCE_PASSWORD 治理成员密码
  DOCS_SCREENSHOT_SUPERUSER_LOGIN     管理员账号
  DOCS_SCREENSHOT_SUPERUSER_PASSWORD  管理员密码
  PLAYWRIGHT_EXECUTABLE_PATH      浏览器可执行文件路径（可选）

  环境变量可从 .env.screenshots 文件自动加载（不覆盖显式设置的终端环境变量）。
`);
}

// ── 根据 manifest 解析基础地址 ─────────────────────────

function resolveProfileBaseUrl(profile, manifest) {
  // 1. profile 自身的 baseUrlEnv
  if (profile.baseUrlEnv) {
    const val = (process.env[profile.baseUrlEnv] || '').trim();
    if (val) return val;
  }
  // 2. manifest 顶层 baseUrlEnv
  if (manifest.baseUrlEnv) {
    const val = (process.env[manifest.baseUrlEnv] || '').trim();
    if (val) return val;
  }
  return null;
}

function buildUrl(baseUrl, pagePath) {
  // 规范化 baseUrl：去除末尾 /
  const base = baseUrl.replace(/\/+$/, '');
  // 确保路径以 / 开头
  const pp = pagePath.startsWith('/') ? pagePath : '/' + pagePath;
  return `${base}${pp}`;
}

function validateUrl(url, label) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error(`协议必须是 http: 或 https:，当前为 ${u.protocol}`);
    }
    return u.href;
  } catch (err) {
    if (err.message.includes('http:') || err.message.includes('https:')) throw err;
    throw new Error(`${label}: 无效的 URL "${url}" — ${err.message}`);
  }
}

// ── Manifest 加载与校验 ──────────────────────────────

function loadAndValidateManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`[错误] manifest 文件不存在: ${MANIFEST_PATH}`);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch (err) {
    console.error(`[错误] manifest 解析失败: ${err.message}`);
    process.exit(1);
  }

  if (!manifest.pages || !Array.isArray(manifest.pages)) {
    console.error('[错误] manifest 中缺少 pages 数组');
    process.exit(1);
  }
  if (manifest.pages.length === 0) {
    console.error('[错误] manifest 中 pages 数组为空');
    process.exit(1);
  }

  const profiles = manifest.authProfiles || {};
  const ids = new Set();
  const outputs = new Set();

  for (const task of manifest.pages) {
    if (!task.id || typeof task.id !== 'string') {
      console.error(`[错误] 任务缺少有效 id: ${JSON.stringify(task)}`);
      process.exit(1);
    }
    if (!task.path || typeof task.path !== 'string') {
      console.error(`[错误] 任务 "${task.id}" 缺少 path`);
      process.exit(1);
    }
    if (!task.waitFor || typeof task.waitFor !== 'string') {
      console.error(`[错误] 任务 "${task.id}" 缺少 waitFor`);
      process.exit(1);
    }
    if (!task.output || typeof task.output !== 'string') {
      console.error(`[错误] 任务 "${task.id}" 缺少 output`);
      process.exit(1);
    }

    if (!task.auth) task.auth = 'public';

    if (!profiles[task.auth]) {
      console.error(
        `[错误] 任务 "${task.id}" 的 auth 引用未知 profile: "${task.auth}"。` +
        `可用 profile: ${Object.keys(profiles).join(', ') || '(无)'}`
      );
      process.exit(1);
    }

    if (ids.has(task.id)) {
      console.error(`[错误] 任务 id 重复: "${task.id}"`);
      process.exit(1);
    }
    ids.add(task.id);

    if (outputs.has(task.output)) {
      console.error(`[错误] 输出路径重复: "${task.output}"`);
      process.exit(1);
    }
    outputs.add(task.output);

    if (!task.path.startsWith('/')) {
      console.error(`[错误] 任务 "${task.id}" 的 path 必须以 "/" 开头: "${task.path}"`);
      process.exit(1);
    }

    const normalized = path.normalize(task.output);
    if (!normalized.startsWith('docs' + path.sep)) {
      console.error(`[错误] 任务 "${task.id}" 的 output 不在 docs/ 目录内: "${task.output}"`);
      process.exit(1);
    }
    if (normalized.includes('..')) {
      console.error(`[错误] 任务 "${task.id}" 的 output 包含越界路径: "${task.output}"`);
      process.exit(1);
    }

    if (task.fullPage === undefined) task.fullPage = false;
  }

  return manifest;
}

// ── 任务筛选 ──────────────────────────────────────────

function filterTasks(tasks, profiles, cli) {
  let selected = [...tasks];

  if (cli.auth) {
    const auth = cli.auth.trim();
    if (!profiles[auth]) {
      console.error(`[错误] 未知认证 profile: "${auth}"。可用: ${Object.keys(profiles).join(', ')}`);
      process.exit(1);
    }
    selected = selected.filter(t => t.auth === auth);
    if (selected.length === 0) {
      console.error(`[错误] 没有 auth="${auth}" 的任务。`);
      process.exit(1);
    }
  }

  if (cli.id && cli.id.length > 0) {
    const taskIds = new Set(tasks.map(t => t.id));
    const invalid = cli.id.filter(i => !taskIds.has(i));
    if (invalid.length > 0) {
      console.error(`[错误] 未知任务 ID: ${invalid.join(', ')}。可用: ${[...taskIds].join(', ')}`);
      process.exit(1);
    }
    selected = selected.filter(t => cli.id.includes(t.id));
    if (selected.length === 0) {
      console.error('[错误] 筛选后没有任务。');
      process.exit(1);
    }
  }

  return selected;
}

// ── 列出任务 ──────────────────────────────────────────

function listTasks(tasks, manifest) {
  console.log(`任务数量: ${tasks.length}\n`);
  for (const task of tasks) {
    const profile = (manifest.authProfiles || {})[task.auth] || {};
    const baseUrlEnv = profile.baseUrlEnv || manifest.baseUrlEnv || '(未配置)';
    const baseUrl = resolveProfileBaseUrl(profile, manifest) || '(未设置)';
    console.log(`${task.id}`);
    const baseUrlStatus = baseUrl ? '已配置' : '未配置';
    console.log(`  路径:      ${task.path}`);
    console.log(`  认证:      ${task.auth}`);
    console.log(`  地址变量:  ${baseUrlEnv}（${baseUrlStatus}）`);
    console.log(`  标题验证:  ${task.expectTitle || '(未设置)'}`);
    console.log(`  输出:      ${task.output}`);
    console.log('');
  }
}

// ── 配置预检 ──────────────────────────────────────────

function preCheck(tasks, manifest) {
  const profiles = manifest.authProfiles || {};
  const errors = [];

  // 收集每个任务需要的 profile
  const neededProfiles = new Set(tasks.map(t => t.auth));

  for (const profileId of neededProfiles) {
    const profile = profiles[profileId];
    if (!profile) continue;

    // 检查 baseUrl
    const baseUrl = resolveProfileBaseUrl(profile, manifest);
    if (!baseUrl) {
      const envName = profile.baseUrlEnv || manifest.baseUrlEnv || 'SCREENSHOT_BASE_URL';
      errors.push(`认证 profile "${profileId}": 地址变量 ${envName} 未设置或为空`);
      continue;
    }

    try {
      validateUrl(baseUrl, `profile "${profileId}"`);
    } catch (err) {
      errors.push(`认证 profile "${profileId}": ${err.message}`);
    }

    // public 不需要凭据
    if (profileId === 'public') continue;

    // 检查凭据
    if (profile.loginEnv) {
      const val = (process.env[profile.loginEnv] || '').trim();
      if (!val) errors.push(`认证 profile "${profileId}": 环境变量 ${profile.loginEnv} 未设置或为空`);
    }
    if (profile.passwordEnv) {
      const val = (process.env[profile.passwordEnv] || '').trim();
      if (!val) errors.push(`认证 profile "${profileId}": 环境变量 ${profile.passwordEnv} 未设置或为空`);
    }
  }

  if (errors.length > 0) {
    console.error('[错误] 配置预检失败:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

// ── 浏览器启动策略 ───────────────────────────────────

async function launchBrowser() {
  const execPath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

  if (execPath) {
    console.log('[浏览器] 使用 PLAYWRIGHT_EXECUTABLE_PATH');
    return chromium.launch({ executablePath: execPath, headless: true });
  }

  try {
    const browser = await chromium.launch({ headless: true });
    console.log('[浏览器] 使用 Playwright 自带 Chromium');
    return browser;
  } catch (_) {}

  try {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    console.log('[浏览器] 使用系统 Chrome');
    return browser;
  } catch (_) {}

  console.error(
    '[错误] 找不到可用的浏览器。请执行以下任一操作：\n' +
      '  1. npx playwright install chromium\n' +
      '  2. 设置 PLAYWRIGHT_EXECUTABLE_PATH 指向可执行浏览器路径\n' +
      '  3. 安装 Google Chrome 到系统默认位置'
  );
  process.exit(1);
}

// ── 递归查找 .tmp 文件 ──────────────────────────────

function findTmpFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findTmpFiles(fullPath));
    else if (entry.name.endsWith('.tmp')) results.push(fullPath);
  }
  return results;
}

// ── 浏览器上下文 ─────────────────────────────────────

function createContext(browser) {
  return browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
  });
}

async function injectDisableAnimations(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important; animation-delay: 0s !important;
        transition-duration: 0s !important; transition-delay: 0s !important;
        scroll-behavior: auto !important; caret-color: transparent !important;
      }
    `,
  });
}

// ── 登录流程 ──────────────────────────────────────────

async function performLogin(profileId, profile, browserContext, baseUrl) {
  const loginUrl = buildUrl(baseUrl, profile.loginPath);
  const page = await browserContext.newPage();

  console.log(`[登录] ${profileId} ← ${loginUrl}`);

  try {
    const response = await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!response || !response.ok()) {
      const status = response ? response.status() : '无响应';
      throw new Error(`登录页响应失败 (HTTP ${status})`);
    }

    await page.waitForSelector('form[method="post"]', { timeout: 10000 });

    const worldSelect = page.locator('select[name="world_id"]');
    if (await worldSelect.isVisible().catch(() => false)) {
      const options = await worldSelect.locator('option').all();
      if (options.length > 0) {
        const firstValue = await options[0].getAttribute('value');
        if (firstValue) await worldSelect.selectOption(firstValue);
      }
    }

    const username = (process.env[profile.loginEnv] || '').trim();
    const password = (process.env[profile.passwordEnv] || '').trim();
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);

    const submitBtn = page.locator('button[type="submit"], input[type="submit"]');
    await submitBtn.first().click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    const pageTitle = await page.title();

    if (currentUrl.includes(profile.loginPath)) {
      throw new Error(
        `登录后仍在登录页\n` +
        `  认证 profile: ${profileId}\n  当前 URL: ${currentUrl}\n  页面标题: "${pageTitle}"\n` +
        `  登录可能失败（用户名或密码错误，或账号被锁定）。`
      );
    }

    if (pageTitle.includes(LOGIN_PAGE_TITLE)) {
      throw new Error(
        `登录后页面标题仍为登录页\n` +
        `  认证 profile: ${profileId}\n  当前 URL: ${currentUrl}\n  页面标题: "${pageTitle}"`
      );
    }

    const successCheck = profile.loginSuccessCheck;
    if (successCheck) {
      if (successCheck.urlNotContain && currentUrl.includes(successCheck.urlNotContain)) {
        throw new Error(
          `登录后 URL 仍包含 "${successCheck.urlNotContain}"\n` +
          `  认证 profile: ${profileId}\n  当前 URL: ${currentUrl}`
        );
      }
      if (successCheck.selector) {
        try {
          await page.waitForSelector(successCheck.selector, { timeout: 5000 });
        } catch (err) {
          throw new Error(
            `登录成功验证选择器未出现: "${successCheck.selector}"\n` +
            `  认证 profile: ${profileId}\n  当前 URL: ${currentUrl}\n  页面标题: "${pageTitle}"`
          );
        }
      }
    }

    console.log(`  → 登录成功 (${profileId}) URL: ${currentUrl}`);
  } catch (err) {
    console.error(`\n  ✗ 登录失败: ${profileId}`);
    console.error(`    登录路径: ${loginUrl}`);
    console.error(`    失败原因: ${err.message}`);
    throw err;
  } finally {
    if (!page.isClosed()) await page.close();
  }
}

// ── 截图逻辑 ─────────────────────────────────────────

async function takeScreenshot(sharedContext, task, profile, baseUrl) {
  const taskTitle = task.title || task.id;
  const url = buildUrl(baseUrl, task.path);
  const outputPath = path.join(ROOT_DIR, task.output);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  console.log(`[截图] ${taskTitle} (${task.id}) ← ${task.path} [${task.auth}]`);

  const page = await sharedContext.newPage();

  try {
    await injectDisableAnimations(page);

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!response || !response.ok()) {
      const status = response ? response.status() : '无响应';
      throw new Error(`页面响应失败 (HTTP ${status})`);
    }

    if (task.auth !== 'public') {
      const currentUrl = page.url();
      const currentTitle = await page.title();
      if (currentUrl.includes('/login') || currentTitle.includes(LOGIN_PAGE_TITLE)) {
        throw new Error(
          `受保护页面被重定向到登录页\n  认证可能已过期\n  当前 URL: ${currentUrl}\n  页面标题: "${currentTitle}"`
        );
      }
    }

    try {
      await page.waitForSelector(task.waitFor, { timeout: 10000 });
    } catch (err) {
      throw new Error(
        `选择器未出现: "${task.waitFor}"（超时 10s）\n  当前 URL: ${url}\n  原始错误: ${err.message}`
      );
    }

    if (task.expectTitle && typeof task.expectTitle === 'string') {
      const pageTitle = await page.title();
      if (!pageTitle.includes(task.expectTitle)) {
        throw new Error(
          `页面标题不符合预期\n  任务名称: ${taskTitle}\n  当前 URL: ${url}\n` +
          `  预期标题包含: "${task.expectTitle}"\n  实际页面标题: "${pageTitle}"`
        );
      }
    }

    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);

    const pngBuffer = await page.screenshot({ fullPage: task.fullPage || false });
    if (!pngBuffer || pngBuffer.length === 0) throw new Error('Playwright 截图返回空 Buffer');

    const webpBuffer = await sharp(pngBuffer).webp({ quality: 85 }).toBuffer();
    if (!webpBuffer || webpBuffer.length === 0) throw new Error('Sharp WebP 转换后 Buffer 为空');

    const metadata = await sharp(webpBuffer).metadata();
    if (metadata.format !== 'webp') throw new Error(`Sharp 输出格式异常: "${metadata.format}"`);
    if (!metadata.width || metadata.width <= 0) throw new Error(`截图宽度无效: ${metadata.width}`);
    if (!metadata.height || metadata.height <= 0) throw new Error(`截图高度无效: ${metadata.height}`);

    fs.writeFileSync(outputPath, webpBuffer);

    if (!fs.existsSync(outputPath)) throw new Error(`写入后文件不存在: ${outputPath}`);
    const fileStat = fs.statSync(outputPath);
    if (fileStat.size === 0) throw new Error(`写入后文件大小为 0: ${outputPath}`);

    const verifyMeta = await sharp(outputPath).metadata();
    if (verifyMeta.format !== 'webp') throw new Error(`写入后格式异常: "${verifyMeta.format}"`);
    if (!verifyMeta.width || verifyMeta.width <= 0) throw new Error(`写入后宽度无效: ${verifyMeta.width}`);
    if (!verifyMeta.height || verifyMeta.height <= 0) throw new Error(`写入后高度无效: ${verifyMeta.height}`);

    const webpSizeKb = (fileStat.size / 1024).toFixed(1);
    console.log(`  → ${task.output}  ${verifyMeta.width}×${verifyMeta.height}  ${webpSizeKb} KB WebP`);

  } catch (err) {
    console.error(`\n  ✗ 任务失败: ${task.id}`);
    console.error(`    任务名称: ${taskTitle}`);
    console.error(`    当前 URL: ${url}`);
    console.error(`    失败原因: ${err.message}`);
    throw err;
  } finally {
    await page.close();
  }
}

// ── 主流程 ───────────────────────────────────────────

async function main() {
  const cli = parseCliArgs();

  if (cli.help) { showHelp(); process.exit(0); }

  const manifest = loadAndValidateManifest();
  const profiles = manifest.authProfiles || {};

  // 筛选任务
  const tasks = filterTasks(manifest.pages, profiles, cli);

  // --list 模式
  if (cli.list) {
    listTasks(tasks, manifest);
    process.exit(0);
  }

  // 配置预检
  preCheck(tasks, manifest);

  // 按 auth 分组
  const tasksByAuth = {};
  for (const task of tasks) {
    const auth = task.auth || 'public';
    if (!tasksByAuth[auth]) tasksByAuth[auth] = [];
    tasksByAuth[auth].push(task);
  }

  console.log(`任务数量: ${tasks.length}`);
  for (const [auth, authTasks] of Object.entries(tasksByAuth)) {
    const resolvedUrl = resolveProfileBaseUrl(profiles[auth] || {}, manifest) || '(未设置)';
    console.log(`  ${auth}: ${authTasks.length} 个任务 | ${resolvedUrl}`);
  }
  console.log('');

  const browser = await launchBrowser();
  let hasError = false;

  try {
    for (const [profileId, authTasks] of Object.entries(tasksByAuth)) {
      const profile = profiles[profileId] || {};
      const baseUrl = resolveProfileBaseUrl(profile, manifest);

      if (profileId === 'public') {
        console.log(`[公开] 无需登录，共 ${authTasks.length} 个任务\n`);
      } else {
        console.log(`[认证] ${profileId}: ${profile.description || ''}，共 ${authTasks.length} 个任务`);
      }

      const context = await createContext(browser);

      try {
        if (profileId !== 'public') {
          await performLogin(profileId, profile, context, baseUrl);
        }
        for (const task of authTasks) {
          try {
            await takeScreenshot(context, task, profile, baseUrl);
          } catch (_) { hasError = true; }
        }
      } finally {
        await context.close();
      }

      if (profileId !== 'public') console.log('');
    }
  } finally {
    await browser.close();
  }

  // .tmp 残留检查
  const docsProductPages = path.join(ROOT_DIR, 'docs', 'product-pages');
  const tmpFiles = findTmpFiles(docsProductPages);
  if (tmpFiles.length > 0) {
    console.error('\n[错误] 截图输出目录中发现 .tmp 残留文件:');
    for (const f of tmpFiles) console.error(`  ${path.relative(ROOT_DIR, f)}`);
    console.error('请删除这些文件并排查截图脚本。');
    hasError = true;
  }

  if (hasError) {
    console.error('\n部分任务失败，请检查输出。');
    process.exit(1);
  }

  console.log('\n全部任务完成。');
}

main().catch((err) => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
