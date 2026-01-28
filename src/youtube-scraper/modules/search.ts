import { YouTubeClient } from '../client.js';
import { keywordDetector } from '../detectors/keywords.js';
import { patternDetector } from '../detectors/pattern.js';
import type { SearchOptions, SearchResult, VideoData } from '../types.js';

/**
 * 搜索模块
 */
export class SearchModule {
  /**
   * 搜索视频
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const yt = await YouTubeClient.getInstance();

    try {
      const search = await yt.search(options.query, {
        type: 'video',
      });

      const videos: VideoData[] = [];
      let processedCount = 0;

      // 处理搜索结果
      if (search.results) {
        for (const item of search.results) {
          if (item.type === 'Video') {
            const videoData = this.parseVideoItem(item);
            videos.push(videoData);
            processedCount++;

            if (options.maxResults && processedCount >= options.maxResults) {
              break;
            }
          }
        }
      }

      // 处理续页 (如果有)
      let continuationToken: string | undefined;
      if (search.has_continuation && (!options.maxResults || videos.length < options.maxResults)) {
        // 简化处理：暂不实现续页
        continuationToken = undefined;
      }

      // 如果只要 AI 视频，进行过滤
      let filteredVideos = videos;
      if (options.aiOnly) {
        filteredVideos = videos.filter((v) => v.aiDetection.isAI);
      }

      return {
        videos: filteredVideos,
        continuationToken,
        totalResults: filteredVideos.length,
      };
    } catch (error) {
      throw new Error(`搜索失败: ${error}`);
    }
  }

  /**
   * 解析视频项
   */
  private parseVideoItem(item: any): VideoData {
    const title = item.title?.text || '';
    const description = item.description?.text || '';
    const videoId = item.id;

    // AI 检测
    const keywordResult = keywordDetector.detectFromContent(title, description);
    const patternResult = patternDetector.detectFromContent(title, description);

    // 合并检测结果
    const isAI = keywordResult.isAI || patternResult.isAI;
    const confidence = Math.max(keywordResult.confidence, patternResult.confidence);

    return {
      videoId,
      title,
      description,
      publishDate: item.publish_date ? new Date(item.publish_date).toISOString() : '',
      viewCount: item.views || 0,
      likeCount: 0, // 搜索结果中没有点赞数
      commentCount: 0,
      duration: item.duration?.seconds || 0,
      thumbnails: this.parseThumbnails(item.thumbnails),
      tags: [],
      channel: {
        id: item.channel?.id || '',
        name: item.channel?.name || '',
        handle: item.channel?.handle || '',
        subscriberCount: 0,
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
  }

  /**
   * 解析缩略图
   */
  private parseThumbnails(thumbnails: any): Array<{ url: string; width: number; height: number }> {
    if (!thumbnails) return [];

    const result: Array<{ url: string; width: number; height: number }> = [];

    if (Array.isArray(thumbnails)) {
      for (const thumb of thumbnails) {
        if (thumb.url) {
          result.push({
            url: thumb.url,
            width: thumb.width || 0,
            height: thumb.height || 0,
          });
        }
      }
    }

    return result;
  }

  /**
   * 按日期搜索 (热门 AI 视频)
   */
  async searchTodayAIVideos(maxResults: number = 20): Promise<SearchResult> {
    return this.search({
      query: 'AI video 2024',
      maxResults,
      aiOnly: true,
      sort: 'date',
    });
  }

  /**
   * 按工具搜索 (如 sora, runway)
   */
  async searchByTool(toolName: string, maxResults: number = 20): Promise<SearchResult> {
    return this.search({
      query: `${toolName} AI video`,
      maxResults,
      aiOnly: true,
    });
  }
}

/**
 * 导出默认实例
 */
export const searchModule = new SearchModule();
