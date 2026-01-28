import { YouTubeClient } from '../client.js';
import { keywordDetector } from '../detectors/keywords.js';
import { patternDetector } from '../detectors/pattern.js';
import type { VideoData } from '../types.js';

/**
 * 视频模块
 */
export class VideoModule {
  /**
   * 获取视频详情
   */
  async getVideo(videoId: string): Promise<VideoData | null> {
    const yt = await YouTubeClient.getInstance();

    try {
      const info = await yt.getInfo(videoId);

      if (!info) {
        return null;
      }

      const basicInfo = (info as any).basic_info;
      const secondaryInfo = (info as any).secondary_info;

      // 提取标题和描述
      const title = basicInfo?.title?.toString() || '';
      const description = basicInfo?.short_description?.toString() || '';

      // AI 检测
      const keywordResult = keywordDetector.detectFromContent(title, description);
      const patternResult = patternDetector.detectFromContent(title, description);

      // 合并检测结果
      const isAI = keywordResult.isAI || patternResult.isAI;
      const confidence = Math.max(keywordResult.confidence, patternResult.confidence);

      // 解析订阅数
      let subscriberCount = 0;
      if (secondaryInfo?.owner?.subscriber_count) {
        const subText = secondaryInfo.owner.subscriber_count.toString();
        subscriberCount = this.parseSubscriberCount(subText);
      }

      return {
        videoId,
        title,
        description,
        publishDate: basicInfo?.publish_date ? new Date(basicInfo.publish_date).toISOString() : '',
        viewCount: basicInfo?.view_count || 0,
        likeCount: this.extractLikeCount(info),
        commentCount: 0, // youtubei.js 不再直接提供评论数
        duration: basicInfo?.duration || 0,
        thumbnails: this.parseThumbnails(basicInfo?.thumbnail),
        tags: basicInfo?.keywords || [],
        channel: {
          id: basicInfo?.channel_id || '',
          name: secondaryInfo?.owner?.title?.toString() || secondaryInfo?.owner?.author?.name?.toString() || '',
          handle: basicInfo?.channel_handle?.toString() || '',
          subscriberCount,
        },
        aiDetection: {
          isAI,
          method: keywordResult.isAI ? 'keyword' : 'pattern',
          confidence,
          matchedKeywords: keywordResult.matchedKeywords,
          detectedTool: keywordResult.detectedTool,
          detectedPatterns: patternResult.detectedPatterns,
        },
        collectedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`获取视频失败: ${error}`);
    }
  }

  /**
   * 解析订阅数
   */
  private parseSubscriberCount(subText: string): number {
    const text = subText.toLowerCase().replace(/,/g, '').replace(/ /g, '');

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
   * 提取点赞数
   */
  private extractLikeCount(info: any): number {
    try {
      const basicInfo = (info as any).basic_info;

      // 尝试从 basic_info 获取点赞数
      if (basicInfo?.like_count) {
        const likeText = basicInfo.like_count.toString();
        return this.parseSubscriberCount(likeText);
      }

      // 尝试从 primary_info 获取
      const primaryInfo = (info as any).primary_info;
      if (primaryInfo?.menu?.top_level_buttons) {
        const buttons = primaryInfo.menu.top_level_buttons;
        for (const button of buttons) {
          if (button.like_count) {
            return parseInt(button.like_count, 10) || 0;
          }
        }
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * 解析缩略图
   */
  private parseThumbnails(thumbnail: any): Array<{ url: string; width: number; height: number }> {
    if (!thumbnail) return [];

    const result: Array<{ url: string; width: number; height: number }> = [];

    try {
      // 处理不同格式的缩略图数据
      if (thumbnail.url) {
        result.push({
          url: thumbnail.url,
          width: thumbnail.width || 0,
          height: thumbnail.height || 0,
        });
      }

      if (thumbnail.thumbnails && Array.isArray(thumbnail.thumbnails)) {
        for (const thumb of thumbnail.thumbnails) {
          if (thumb.url) {
            result.push({
              url: thumb.url,
              width: thumb.width || 0,
              height: thumb.height || 0,
            });
          }
        }
      }
    } catch {
      // 忽略解析错误
    }

    return result;
  }

  /**
   * 批量获取视频详情
   */
  async getVideos(videoIds: string[]): Promise<VideoData[]> {
    const results: VideoData[] = [];

    for (const videoId of videoIds) {
      try {
        const video = await this.getVideo(videoId);
        if (video) {
          results.push(video);
        }
      } catch {
        // 忽略单个视频的错误
      }
    }

    return results;
  }

  /**
   * 验证视频是否为 AI 视频
   */
  async isAIVideo(videoId: string): Promise<boolean> {
    const video = await this.getVideo(videoId);
    return video?.aiDetection.isAI || false;
  }
}

/**
 * 导出默认实例
 */
export const videoModule = new VideoModule();
