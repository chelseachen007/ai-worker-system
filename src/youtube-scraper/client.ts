import { Innertube, UniversalCache } from 'youtubei.js';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * YouTube.js 客户端单例
 */
class YouTubeClient {
  private static instance: Innertube | null = null;
  private static cachePath: string;

  /**
   * 获取缓存目录
   */
  private static getCacheDir(): string {
    if (!this.cachePath) {
      const cacheDir = path.join(process.cwd(), 'storage', '.youtube-cache');
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }
      this.cachePath = cacheDir;
    }
    return this.cachePath;
  }

  /**
   * 初始化客户端
   */
  private static async initialize(): Promise<Innertube> {
    try {
      const client = await Innertube.create({
        cache: new UniversalCache(false, this.getCacheDir()),
        generate_session_locally: true,
      });

      return client;
    } catch (error) {
      throw new Error(`YouTube 客户端初始化失败: ${error}`);
    }
  }

  /**
   * 获取客户端实例 (单例模式)
   */
  static async getInstance(): Promise<Innertube> {
    if (!this.instance) {
      this.instance = await this.initialize();
    }
    return this.instance;
  }

  /**
   * 重置客户端 (清除连接)
   */
  static async reset(): Promise<void> {
    if (this.instance) {
      try {
        // 没有直接的 close 方法，将实例置空即可
        this.instance = null;
      } catch {
        // 忽略错误
      }
    }
  }

  /**
   * 检查客户端健康状态
   */
  static async ping(): Promise<boolean> {
    try {
      const client = await this.getInstance();
      // 简单验证客户端是否可用
      return !!client;
    } catch {
      return false;
    }
  }
}

export { YouTubeClient };
