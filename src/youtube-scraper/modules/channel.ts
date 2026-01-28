import { YouTubeClient } from '../client.js';
import type { ChannelData } from '../types.js';

/**
 * 频道模块
 */
export class ChannelModule {
  /**
   * 获取频道信息
   */
  async getChannel(channelId: string): Promise<ChannelData | null> {
    const yt = await YouTubeClient.getInstance();

    try {
      const channel = await yt.getChannel(channelId);

      if (!channel) {
        return null;
      }

      const metadata = (channel as any).metadata;
      const header = (channel as any).header;

      return {
        channelId,
        name: metadata?.title?.toString() || metadata?.channel_name?.toString() || '',
        handle: (metadata as any)?.handle?.toString() || metadata?.channel_handle?.toString() || '',
        subscriberCount: this.parseSubscriberCount((metadata as any)?.subscribers?.toString()),
        videoCount: this.parseVideoCount((metadata as any)?.videos?.toString()),
        isVerified: this.hasVerifiedBadge(metadata),
        avatar: this.extractAvatar(metadata),
        banner: this.extractBanner(header),
        description: metadata?.description?.toString(),
        collectedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`获取频道失败: ${error}`);
    }
  }

  /**
   * 解析订阅数
   */
  private parseSubscriberCount(subscribers?: string): number {
    if (!subscribers) return 0;

    const text = subscribers.toLowerCase().replace(/,/g, '').replace(/ /g, '');

    // 处理 "1.2M", "300K", "1.5B" 等格式
    const match = text.match(/^([\d.]+)([kmb]?)$/);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'k':
        return Math.floor(num * 1000);
      case 'm':
        return Math.floor(num * 1000000);
      case 'b':
        return Math.floor(num * 1000000000);
      default:
        return Math.floor(num);
    }
  }

  /**
   * 解析视频数
   */
  private parseVideoCount(videos?: string): number {
    if (!videos) return 0;

    const text = videos.toLowerCase().replace(/,/g, '').replace(/ /g, '');
    const match = text.match(/^([\d.]+)([kmb]?)$/);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'k':
        return Math.floor(num * 1000);
      case 'm':
        return Math.floor(num * 1000000);
      case 'b':
        return Math.floor(num * 1000000000);
      default:
        return Math.floor(num);
    }
  }

  /**
   * 检查是否有认证徽章
   */
  private hasVerifiedBadge(metadata: any): boolean {
    if (!metadata) return false;

    // 检查 badges 属性
    if (metadata.badges) {
      const badges = Array.isArray(metadata.badges) ? metadata.badges : [];
      return badges.some((b: any) => b.type === 'VERIFIED');
    }

    return false;
  }

  /**
   * 提取头像 URL
   */
  private extractAvatar(metadata: any): string | undefined {
    if (!metadata) return undefined;

    if (metadata.avatar) {
      const avatars = Array.isArray(metadata.avatar) ? metadata.avatar : [metadata.avatar];
      return avatars[0]?.url;
    }

    return undefined;
  }

  /**
   * 提取横幅 URL
   */
  private extractBanner(header: any): string | undefined {
    if (!header) return undefined;

    // 尝试获取 banner
    if (header.banner) {
      const banners = Array.isArray(header.banner) ? header.banner : [header.banner];
      return banners[0]?.url;
    }

    // 尝试从不同类型的 header 获取
    if (header.author) {
      return header.author.banner?.[0]?.url;
    }

    return undefined;
  }

  /**
   * 通过 handle 获取频道
   */
  async getChannelByHandle(handle: string): Promise<ChannelData | null> {
    const yt = await YouTubeClient.getInstance();

    try {
      const channel = await yt.getChannel(handle);

      if (!channel) {
        return null;
      }

      // 从 channel 对象获取 channel ID
      const channelId = (channel as any).channel_id || (channel as any).id;
      if (!channelId) {
        return null;
      }

      return this.getChannel(channelId);
    } catch {
      return null;
    }
  }

  /**
   * 获取频道的视频列表
   */
  async getChannelVideos(channelId: string, maxResults: number = 20): Promise<string[]> {
    const yt = await YouTubeClient.getInstance();

    try {
      const channel = await yt.getChannel(channelId);

      if (!channel) {
        return [];
      }

      const videos: string[] = [];

      // 获取频道的视频
      const videosTab = await (channel as any).getVideos();
      if (videosTab && videosTab.videos) {
        let count = 0;
        for (const item of videosTab.videos) {
          const itemId = (item as any).id || (item as any).videoId;
          if (itemId && (item as any).type === 'Video') {
            videos.push(itemId);
            count++;
            if (maxResults && count >= maxResults) {
              break;
            }
          }
        }
      }

      return videos;
    } catch (error) {
      throw new Error(`获取频道视频失败: ${error}`);
    }
  }
}

/**
 * 导出默认实例
 */
export const channelModule = new ChannelModule();
