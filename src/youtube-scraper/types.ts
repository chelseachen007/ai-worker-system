/**
 * AI 检测结果
 */
export interface AIDetection {
  /** 是否为 AI 生成内容 */
  isAI: boolean;
  /** 检测方法 */
  method: 'keyword' | 'pattern' | 'model';
  /** 置信度 (0-1) */
  confidence: number;
  /** 匹配的关键词 */
  matchedKeywords: string[];
  /** 检测到的 AI 工具 */
  detectedTool?: string;
  /** 检测到的模式 */
  detectedPatterns: string[];
}

/**
 * 视频缩略图
 */
export interface VideoThumbnail {
  url: string;
  width: number;
  height: number;
}

/**
 * 频道信息
 */
export interface ChannelInfo {
  id: string;
  name: string;
  handle: string;
  subscriberCount: number;
}

/**
 * 视频数据
 */
export interface VideoData {
  videoId: string;
  title: string;
  description: string;
  publishDate: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: number;
  thumbnails: VideoThumbnail[];
  tags: string[];
  channel: ChannelInfo;
  aiDetection: AIDetection;
  collectedAt: string;
}

/**
 * 频道数据
 */
export interface ChannelData {
  channelId: string;
  name: string;
  handle: string;
  subscriberCount: number;
  videoCount: number;
  isVerified: boolean;
  avatar?: string;
  banner?: string;
  description?: string;
  collectedAt: string;
}

/**
 * 评论数据
 */
export interface CommentData {
  commentId: string;
  videoId: string;
  author: string;
  authorChannelId?: string;
  content: string;
  likeCount: number;
  publishDate: string;
  isReply: boolean;
  parentId?: string;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  /** 搜索查询 */
  query: string;
  /** 最大结果数 */
  maxResults?: number;
  /** 只返回 AI 视频 */
  aiOnly?: boolean;
  /** 排序方式 */
  sort?: 'relevance' | 'date' | 'viewCount' | 'rating';
  /** 上次搜索的 token (用于翻页) */
  continuationToken?: string;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  videos: VideoData[];
  continuationToken?: string;
  totalResults: number;
}

/**
 * 视频收藏集合
 */
export interface VideoCollection {
  id: string;
  name: string;
  description?: string;
  query: string;
  videoIds: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 存储统计信息
 */
export interface StorageStats {
  totalVideos: number;
  aiVideos: number;
  totalChannels: number;
  totalCollections: number;
  storageSize: number;
}

/**
 * AI 关键词类别
 */
export interface AIKeywordCategory {
  name: string;
  keywords: string[];
  weight: number;
}

/**
 * 模式匹配规则
 */
export interface PatternRule {
  name: string;
  pattern: RegExp;
  description: string;
  weight: number;
}
