import { EggLogger } from 'egg';
import { Inject, HTTPController, HTTPMethod, HTTPMethodEnum, Context, EggContext } from '@eggjs/tegg';
import puppeteer, { GoToOptions, Browser, Page } from 'puppeteer';
import { Readable } from 'node:stream';

const locals = {
  // LocalStorageUseVue3Dev: '1',
  // LocalStorageUseVue3DevUrl:	'https://127.0.0.1:3333',
};

// 域名
const domain = '';
const cookies = {
  /**
       * Cookie name.
       */
  name: 'Authorization',
  /**
       * Cookie value.
       */
  value: 'Bearer%20eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTE4MCwibmFtZSI6IuW8oOavkyIsIm1vYmlsZSI6InpoYW5neXUiLCJpc0FjdGl2ZSI6dHJ1ZSwic3VwcGxpZXJJZCI6bnVsbCwiY29tcGFueUlkIjowLCJkZXBhcnRtZW50SWQiOiIiLCJyb2xlcyI6IjEiLCJjdXJSb2xlIjoxLCJ3eHVzZXJpZCI6bnVsbCwiYXV0b0xvZ2luIjpmYWxzZSwicG9zaXRpb24iOiIiLCJwd2RWZXJzaW9uIjoyLCJsb2dpblRva2VuVHlwZSI6InF3IiwibG9naW5SZXF1ZXN0SWQiOiIzYjY4NDMxOC1hNWYxLTQ5OTEtODRmNC05MDUyNjYyOTM4YWQiLCJpYXQiOjE3NDg5MTMyMjUsImV4cCI6MTc0OTUxODAyNX0.TA7uwL6iD462DP3e8KRfQGe2U5Rb9eyrpHqu9XUKL_E',
  /**
       * Cookie domain.
       */
  domain,
  /**
       * The request-URI to associate with the setting of the cookie. This value can affect
       * the default domain, path, and source scheme values of the created cookie.
       */
  // url?: string;
  /**
       * Cookie path.
       */
  // path?: string;
  /**
       * Cookie expiration date, session cookie if not set
       */
  // expires?: number;
};


@HTTPController({
  path: '/',
})
export class HomeController {
  @Inject()
  logger: EggLogger;

  @HTTPMethod({
    method: HTTPMethodEnum.GET,
    path: '/',
  })
  async index(@Context() ctx: EggContext) {
    let browser: Browser | null = null;
    let page: Page | null = null;

    // 添加计时变量
    const startTime = Date.now();
    let lastStepTime = startTime;

    // 创建格式化日志的函数
    const formatLog = (message: string) => {
      const now = Date.now();
      const totalTime = now - startTime;
      const stepTime = now - lastStepTime;
      lastStepTime = now; // 更新上一步骤的时间
      return `${new Date().toLocaleString('en-US')} ${message} ${totalTime}ms (${stepTime}ms)`;
    };

    try {
      this.logger.info(formatLog('初始化日志(hello egg logger)'));

      browser = await puppeteer.launch({
        headless: true,
        timeout: 60000,
        // args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      page = await browser.newPage();

      const options: GoToOptions = {
        waitUntil: 'load',
        timeout: 60000,
      };

      if (!page) {
        throw new Error('无法创建浏览器页面');
      }

      await page.setCookie(cookies);

      this.logger.info(formatLog('导航到登录页面(navigate to login)'));
      await page.goto(`https://${domain}/#/loign`, { ...options });

      await page.evaluate(values => {
        for (const key in values) {
          localStorage.setItem(key, values[key]);
        }
      }, locals);

      const url = `https://${domain}/#/printPdfService`;
      this.logger.info(formatLog('导航到打印服务页面(navigate to print service)'));
      await page.goto(url, { ...options });

      this.logger.info(formatLog('等待页面初始化完成(wait for page init)'));
      await Promise.race([
        page.evaluate(() => {
          return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('等待页面初始化超时'));
            }, 30000);

            window.top?.document.addEventListener('printPdfPageReady', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('页面初始化超时')), 30000)),
      ]);

      this.logger.info(formatLog('执行打印(ShowPrint)'));
      await page.evaluate(() => {
        const params = {
          orderId: 3224,
          targetId: 3224,
          type: 'otherReceipt',
          skipChoose: 1,
          directFile: 1,
        };

        function sendEvent<T extends Element>(
          eventName: string,
          data?: any,
          option?: { immediate?: boolean; target?: T },
        ) {
          const immediate = option?.immediate ?? true;
          const target = option?.target ?? window.top?.document;
          const event = new CustomEvent(eventName, data);
          if (immediate) {
            target?.dispatchEvent(event);
          } else {
            return () => {
              target?.dispatchEvent(event);
            };
          }
        }
        sendEvent('printPdfEvent', { detail: params });
        return;
      });


      this.logger.info(formatLog('等待PDF生成回调(wait for pdf callback)'));

      const eventRes = await Promise.race([
        page.evaluate(() => {
          return new Promise<{
            file: string,
            fileName: string,
            printLogData: Array<{
              logTime: number,
              logMessage: string,
              time: number,
              step: number
            }>
          }>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('等待PDF生成超时'));
            }, 60000);

            window.top?.document.addEventListener('jsBillPrintPdfSuccess', (event: any) => {
              clearTimeout(timeout);
              resolve(event.detail);
              console.log('前端生成PDF Event :>> ', event.detail);
            });
          });
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PDF生成超时')), 60000)),
      ]);

      this.logger.info(formatLog('PDF生成成功，准备关闭浏览器(close browser)'));

      if (page) await page.close();
      if (browser) await browser.close();
      page = null;
      browser = null;

      const binaryData = atob(eventRes.file);

      const pdf = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        pdf[i] = binaryData.charCodeAt(i);
      }

      const fileName = eventRes.fileName.replace('-打印', '');
      ctx.set('Content-Disposition', `attachment; filename="${fileName}"`);
      ctx.set('Content-Type', 'application/octet-stream');
      ctx.set('Content-Length', `${pdf.length}`);
      ctx.body = Buffer.from(pdf);

      this.logger.info(formatLog('PDF文件生成成功并返回客户端(pdf success)'));
    } catch (error: any) {
      this.logger.error(`${formatLog('生成PDF出错(pdf error)')}:`, error.message);
      if (page) await page.close().catch(e => this.logger.error('关闭页面出错:', e));
      if (browser) await browser.close().catch(e => this.logger.error('关闭浏览器出错:', e));

      ctx.status = 500;
      ctx.body = {
        success: false,
        message: `生成PDF失败: ${error.message || '未知错误'}`,
      };
    }
  }

  @HTTPMethod({
    method: HTTPMethodEnum.GET,
    path: '/message',
  })
  async message(@Context() ctx: EggContext) {
    ctx.set('Content-Type', 'text/event-stream');
    ctx.set('Cache-Control', 'no-cache');
    ctx.set('Connection', 'keep-alive');

    const stream = new Readable({
      read() {},
    });

    const intervalId = setInterval(() => {
      stream.push(`data: ${new Date().toISOString()}\n\n`);
    }, 1500);

    setTimeout(() => {
      clearInterval(intervalId);
      stream.push(null);
    }, 15_000);

    return stream;
  }
}
