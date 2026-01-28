import path from 'node:path';
import { readJSON, writeJSON, ensureDir, listDir } from '../../storage/filesystem.js';
import type { VideoData, ChannelData, VideoCollection, StorageStats } from '../types.js';

/**
 * YouTube 数据存储目录
 */
const YOUTUBE_DATA_DIR = 'storage/youtube-data';

/**
 * 视频存储目录
 */
const VIDEOS_DIR = path.join(YOUTUBE_DATA_DIR, 'videos');

/**
 * 频道存储目录
 */
const CHANNELS_DIR = path.join(YOUTUBE_DATA_DIR, 'channels');

/**
 * 集合存储目录
 */
const COLLECTIONS_DIR = path.join(YOUTUBE_DATA_DIR, 'collections');

/**
 * YouTube 数据存储层
 */
export class YouTubeStore {
  /**
   * 保存视频数据
   */
  async saveVideo(video: VideoData): Promise<void> {
    const filePath = path.join(VIDEOS_DIR, `${video.videoId}.json`);
    await writeJSON(filePath, video);
  }

  /**
   * 批量保存视频
   */
  async saveVideos(videos: VideoData[]): Promise<void> {
    for (const video of videos) {
      await this.saveVideo(video);
    }
  }

  /**
   * 读取视频数据
   */
  async getVideo(videoId: string): Promise<VideoData | null> {
    const filePath = path.join(VIDEOS_DIR, `${videoId}.json`);
    return await readJSON<VideoData>(filePath);
  }

  /**
   * 列出所有已保存的视频
   */
  async listVideos(): Promise<VideoData[]> {
    await ensureDir(VIDEOS_DIR);
    const files = await listDir(VIDEOS_DIR);
    const videos: VideoData[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const video = await readJSON<VideoData>(path.join(VIDEOS_DIR, file));
        if (video) {
          videos.push(video);
        }
      }
    }

    return videos.sort((a, b) =>
      new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime(),
    );
  }

  /**
   * 列出 AI 视频
   */
  async listAIVideos(): Promise<VideoData[]> {
    const allVideos = await this.listVideos();
    return allVideos.filter((v) => v.aiDetection.isAI);
  }

  /**
   * 按关键词搜索视频
   */
  async searchVideos(keyword: string): Promise<VideoData[]> {
    const allVideos = await this.listVideos();
    const lowerKeyword = keyword.toLowerCase();

    return allVideos.filter((v) =>
      v.title.toLowerCase().includes(lowerKeyword) ||
      v.description.toLowerCase().includes(lowerKeyword) ||
      v.aiDetection.matchedKeywords.some((k) => k.toLowerCase().includes(lowerKeyword)),
    );
  }

  /**
   * 按工具名称搜索视频
   */
  async searchByTool(toolName: string): Promise<VideoData[]> {
    const allVideos = await this.listVideos();
    const lowerTool = toolName.toLowerCase();

    return allVideos.filter((v) =>
      v.aiDetection.matchedKeywords.some((k) => k.toLowerCase().includes(lowerTool)),
    );
  }

  /**
   * 保存频道数据
   */
  async saveChannel(channel: ChannelData): Promise<void> {
    const filePath = path.join(CHANNELS_DIR, `${channel.channelId}.json`);
    await writeJSON(filePath, channel);
  }

  /**
   * 读取频道数据
   */
  async getChannel(channelId: string): Promise<ChannelData | null> {
    const filePath = path.join(CHANNELS_DIR, `${channelId}.json`);
    return await readJSON<ChannelData>(filePath);
  }

  /**
   * 列出所有频道
   */
  async listChannels(): Promise<ChannelData[]> {
    await ensureDir(CHANNELS_DIR);
    const files = await listDir(CHANNELS_DIR);
    const channels: ChannelData[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const channel = await readJSON<ChannelData>(path.join(CHANNELS_DIR, file));
        if (channel) {
          channels.push(channel);
        }
      }
    }

    return channels.sort((a, b) => b.subscriberCount - a.subscriberCount);
  }

  /**
   * 创建视频收藏集合
   */
  async createCollection(
    name: string,
    query: string,
    description?: string,
  ): Promise<VideoCollection> {
    const id = this.generateCollectionId(name);
    const collection: VideoCollection = {
      id,
      name,
      description,
      query,
      videoIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveCollection(collection);
    return collection;
  }

  /**
   * 保存收藏集合
   */
  async saveCollection(collection: VideoCollection): Promise<void> {
    const filePath = path.join(COLLECTIONS_DIR, `${collection.id}.json`);
    await writeJSON(filePath, collection);
  }

  /**
   * 获取收藏集合
   */
  async getCollection(id: string): Promise<VideoCollection | null> {
    const filePath = path.join(COLLECTIONS_DIR, `${id}.json`);
    return await readJSON<VideoCollection>(filePath);
  }

  /**
   * 列出所有收藏集合
   */
  async listCollections(): Promise<VideoCollection[]> {
    await ensureDir(COLLECTIONS_DIR);
    const files = await listDir(COLLECTIONS_DIR);
    const collections: VideoCollection[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const collection = await readJSON<VideoCollection>(path.join(COLLECTIONS_DIR, file));
        if (collection) {
          collections.push(collection);
        }
      }
    }

    return collections.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  /**
   * 向收藏集合添加视频
   */
  async addToCollection(collectionId: string, videoId: string): Promise<void> {
    const collection = await this.getCollection(collectionId);
    if (!collection) {
      throw new Error(`收藏集合不存在: ${collectionId}`);
    }

    if (!collection.videoIds.includes(videoId)) {
      collection.videoIds.push(videoId);
      collection.updatedAt = new Date().toISOString();
      await this.saveCollection(collection);
    }
  }

  /**
   * 批量向收藏集合添加视频
   */
  async addVideosToCollection(collectionId: string, videoIds: string[]): Promise<void> {
    const collection = await this.getCollection(collectionId);
    if (!collection) {
      throw new Error(`收藏集合不存在: ${collectionId}`);
    }

    for (const videoId of videoIds) {
      if (!collection.videoIds.includes(videoId)) {
        collection.videoIds.push(videoId);
      }
    }

    collection.updatedAt = new Date().toISOString();
    await this.saveCollection(collection);
  }

  /**
   * 获取收藏集合中的视频
   */
  async getCollectionVideos(collectionId: string): Promise<VideoData[]> {
    const collection = await this.getCollection(collectionId);
    if (!collection) {
      return [];
    }

    const videos: VideoData[] = [];
    for (const videoId of collection.videoIds) {
      const video = await this.getVideo(videoId);
      if (video) {
        videos.push(video);
      }
    }

    return videos;
  }

  /**
   * 删除收藏集合
   */
  async deleteCollection(id: string): Promise<void> {
    const filePath = path.join(COLLECTIONS_DIR, `${id}.json`);
    const { removeFile } = await import('../../storage/filesystem.js');
    await removeFile(filePath);
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<StorageStats> {
    const { statSync } = await import('node:fs');
    const { readdirSync } = await import('node:fs');

    let totalVideos = 0;
    let aiVideos = 0;

    try {
      await ensureDir(VIDEOS_DIR);
      const videoFiles = await listDir(VIDEOS_DIR);
      totalVideos = videoFiles.filter((f) => f.endsWith('.json')).length;
    } catch {
      // 忽略
    }

    // 统计 AI 视频数量
    try {
      const aiVideosList = await this.listAIVideos();
      aiVideos = aiVideosList.length;
    } catch {
      // 忽略
    }

    let totalChannels = 0;
    try {
      await ensureDir(CHANNELS_DIR);
      const channelFiles = await listDir(CHANNELS_DIR);
      totalChannels = channelFiles.filter((f) => f.endsWith('.json')).length;
    } catch {
      // 忽略
    }

    let totalCollections = 0;
    let storageSize = 0;

    try {
      await ensureDir(COLLECTIONS_DIR);
      const collectionFiles = await listDir(COLLECTIONS_DIR);
      totalCollections = collectionFiles.filter((f) => f.endsWith('.json')).length;
    } catch {
      // 忽略
    }

    try {
      const calcDirSize = (dir: string): number => {
        if (!require('node:fs').existsSync(dir)) return 0;
        let size = 0;
        const files = readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = statSync(filePath);
          if (stats.isDirectory()) {
            size += calcDirSize(filePath);
          } else {
            size += stats.size;
          }
        }
        return size;
      };

      storageSize = calcDirSize(YOUTUBE_DATA_DIR);
    } catch {
      // 忽略
    }

    return {
      totalVideos,
      aiVideos,
      totalChannels,
      totalCollections,
      storageSize,
    };
  }

  /**
   * 生成收藏集合 ID
   */
  private generateCollectionId(name: string): string {
    const timestamp = Date.now();
    const hash = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${hash}-${timestamp}`;
  }

  /**
   * 检查视频是否已存在
   */
  async videoExists(videoId: string): Promise<boolean> {
    const filePath = path.join(VIDEOS_DIR, `${videoId}.json`);
    const { fileExists } = await import('../../storage/filesystem.js');
    return fileExists(filePath);
  }

  /**
   * 检查频道是否已存在
   */
  async channelExists(channelId: string): Promise<boolean> {
    const filePath = path.join(CHANNELS_DIR, `${channelId}.json`);
    const { fileExists } = await import('../../storage/filesystem.js');
    return fileExists(filePath);
  }
}

/**
 * 导出默认实例
 */
export const ytStore = new YouTubeStore();
