/**
 * 页面自动截图脚本
 *
 * 使用方式：
 *   npm run capture:screenshots
 *
 * 前提：
 *   - Live OS 服务已启动
 *   - 默认基础地址 http://127.0.0.1:20101（可通过 SCREENSHOT_BASE_URL 覆盖）
 *
 * 页面配置：
 *   所有任务定义在项目根目录的 screenshot-manifest.json。
 */

const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// ── 常量 ──────────────────────────────────────────────

const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'screenshot-manifest.json');
const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:20101';

const VIEWPORT = { width: 1440, height: 900 };
const DEVICE_SCALE_FACTOR = 1;

// ── 浏览器启动策略 ───────────────────────────────────

async function launchBrowser() {
  const execPath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

  // 1. 环境变量指定路径
  if (execPath) {
    console.log('[浏览器] 使用 PLAYWRIGHT_EXECUTABLE_PATH');
    return chromium.launch({ executablePath: execPath, headless: true });
  }

  // 2. Playwright 自带 Chromium
  try {
    const browser = await chromium.launch({ headless: true });
    console.log('[浏览器] 使用 Playwright 自带 Chromium');
    return browser;
  } catch (_) {
    // 未安装
  }

  // 3. 系统 Chrome
  try {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    console.log('[浏览器] 使用系统 Chrome');
    return browser;
  } catch (_) {
    // 不可用
  }

  // 4. 都不可用
  console.error(
    '[错误] 找不到可用的浏览器。请执行以下任一操作：\n' +
      '  1. npx playwright install chromium\n' +
      '  2. 设置 PLAYWRIGHT_EXECUTABLE_PATH 指向可执行浏览器路径\n' +
      '  3. 安装 Google Chrome 到系统默认位置'
  );
  process.exit(1);
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

  const ids = new Set();
  const outputs = new Set();

  for (const task of manifest.pages) {
    // 必填字段
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

    // id 唯一
    if (ids.has(task.id)) {
      console.error(`[错误] 任务 id 重复: "${task.id}"`);
      process.exit(1);
    }
    ids.add(task.id);

    // output 唯一
    if (outputs.has(task.output)) {
      console.error(`[错误] 输出路径重复: "${task.output}"`);
      process.exit(1);
    }
    outputs.add(task.output);

    // path 为相对 URL
    if (!task.path.startsWith('/')) {
      console.error(`[错误] 任务 "${task.id}" 的 path 必须以 "/" 开头: "${task.path}"`);
      process.exit(1);
    }

    // output 必须在 docs/ 内
    const normalized = path.normalize(task.output);
    if (!normalized.startsWith('docs' + path.sep)) {
      console.error(`[错误] 任务 "${task.id}" 的 output 不在 docs/ 目录内: "${task.output}"`);
      process.exit(1);
    }

    // 禁止 ../ 越界
    if (normalized.includes('..')) {
      console.error(`[错误] 任务 "${task.id}" 的 output 包含越界路径: "${task.output}"`);
      process.exit(1);
    }

    // fullPage 默认 false
    if (task.fullPage === undefined) {
      task.fullPage = false;
    }
  }

  return manifest;
}

// ── 递归查找 .tmp 文件 ──────────────────────────────

function findTmpFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTmpFiles(fullPath));
    } else if (entry.name.endsWith('.tmp')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── 截图逻辑 ─────────────────────────────────────────

async function takeScreenshot(browser, task) {
  const taskTitle = task.title || task.id;
  const url = `${BASE_URL}${task.path}`;
  const outputPath = path.join(ROOT_DIR, task.output);

  // 确保输出目录存在
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  console.log(`[截图] ${taskTitle} (${task.id}) ← ${task.path}`);

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
  });

  let page;
  try {
    page = await context.newPage();

    // 注入 CSS 关闭动画/过渡/光标闪烁/平滑滚动
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          scroll-behavior: auto !important;
          caret-color: transparent !important;
        }
      `,
    });

    // ── 步骤 1: 导航并检查 HTTP 响应 ─────────────────
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!response || !response.ok()) {
      const status = response ? response.status() : '无响应';
      throw new Error(`页面响应失败 (HTTP ${status})`);
    }

    // ── 步骤 2: 等待选择器 ───────────────────────────
    try {
      await page.waitForSelector(task.waitFor, { timeout: 10000 });
    } catch (err) {
      throw new Error(
        `选择器未出现: "${task.waitFor}"（超时 10s）\n` +
        `  当前 URL: ${url}\n` +
        `  原始错误: ${err.message}`
      );
    }

    // ── 步骤 3: 校验页面标题 ─────────────────────────
    if (task.expectTitle && typeof task.expectTitle === 'string') {
      const pageTitle = await page.title();
      if (!pageTitle.includes(task.expectTitle)) {
        throw new Error(
          `页面标题不符合预期\n` +
          `  任务名称: ${taskTitle}\n` +
          `  当前 URL: ${url}\n` +
          `  预期标题包含: "${task.expectTitle}"\n` +
          `  实际页面标题: "${pageTitle}"`
        );
      }
    }

    // ── 步骤 4: 等待字体加载 ─────────────────────────
    await page.evaluate(() => document.fonts.ready);

    // ── 步骤 5: 等待异步渲染完成 ─────────────────────
    await page.waitForTimeout(1500);

    // ── 步骤 6: 截图 → PNG Buffer → WebP Buffer ──────
    const pngBuffer = await page.screenshot({ fullPage: task.fullPage || false });

    // 校验 PNG Buffer 非空
    if (!pngBuffer || pngBuffer.length === 0) {
      throw new Error('Playwright 截图返回空 Buffer');
    }

    // Sharp 在内存中将 PNG Buffer 转换为 WebP Buffer
    const webpBuffer = await sharp(pngBuffer).webp({ quality: 85 }).toBuffer();

    // 校验 WebP Buffer 非空
    if (!webpBuffer || webpBuffer.length === 0) {
      throw new Error('Sharp WebP 转换后 Buffer 为空');
    }

    // 从 Buffer 读取像素尺寸（写入前预检）
    const metadata = await sharp(webpBuffer).metadata();
    if (metadata.format !== 'webp') {
      throw new Error(`Sharp 输出格式异常: "${metadata.format}"，预期 "webp"`);
    }
    const w = metadata.width;
    const h = metadata.height;
    if (!w || w <= 0) {
      throw new Error(`截图宽度无效: ${w}`);
    }
    if (!h || h <= 0) {
      throw new Error(`截图高度无效: ${h}`);
    }

    // ── 步骤 7: 直接写入正式 .webp 文件 ──────────────
    fs.writeFileSync(outputPath, webpBuffer);

    // ── 步骤 8: 写入后验证 ───────────────────────────
    if (!fs.existsSync(outputPath)) {
      throw new Error(`写入后文件不存在: ${outputPath}`);
    }
    const fileStat = fs.statSync(outputPath);
    if (fileStat.size === 0) {
      throw new Error(`写入后文件大小为 0: ${outputPath}`);
    }

    // 重新读取 metadata 确认格式和尺寸
    const verifyMeta = await sharp(outputPath).metadata();
    if (verifyMeta.format !== 'webp') {
      throw new Error(`写入后文件格式异常: "${verifyMeta.format}"，预期 "webp"`);
    }
    if (!verifyMeta.width || verifyMeta.width <= 0) {
      throw new Error(`写入后文件宽度无效: ${verifyMeta.width}`);
    }
    if (!verifyMeta.height || verifyMeta.height <= 0) {
      throw new Error(`写入后文件高度无效: ${verifyMeta.height}`);
    }

    const webpSizeKb = (fileStat.size / 1024).toFixed(1);
    console.log(`  → ${task.output}  ${verifyMeta.width}×${verifyMeta.height}  ${webpSizeKb} KB WebP`);

  } catch (err) {
    // 输出详细失败信息
    console.error(`\n  ✗ 任务失败: ${task.id}`);
    console.error(`    任务名称: ${taskTitle}`);
    console.error(`    当前 URL: ${url}`);
    console.error(`    失败原因: ${err.message}`);
    throw err;
  } finally {
    // 无论成功或失败都正确关闭上下文
    await context.close();
  }
}

// ── 主流程 ───────────────────────────────────────────

async function main() {
  const manifest = loadAndValidateManifest();
  const tasks = manifest.pages;

  console.log(`Live OS 地址: ${BASE_URL}`);
  console.log(`任务数量: ${tasks.length}\n`);

  const browser = await launchBrowser();
  let hasError = false;

  try {
    for (const task of tasks) {
      try {
        await takeScreenshot(browser, task);
      } catch (err) {
        // 错误信息已在 takeScreenshot 中输出
        hasError = true;
      }
    }
  } finally {
    await browser.close();
  }

  // ── 任务完成后递归检查 .tmp 残留 ──────────────────
  const docsProductPages = path.join(ROOT_DIR, 'docs', 'product-pages');
  const tmpFiles = findTmpFiles(docsProductPages);

  if (tmpFiles.length > 0) {
    console.error('\n[错误] 截图输出目录中发现 .tmp 残留文件:');
    for (const f of tmpFiles) {
      console.error(`  ${path.relative(ROOT_DIR, f)}`);
    }
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
