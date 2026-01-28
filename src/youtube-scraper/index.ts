/**
 * YouTube Scraper 模块
 *
 * 用于采集和分析 YouTube 上的 AI 生成视频
 */

// 导出类型
export * from './types.js';

// 导出客户端
export { YouTubeClient } from './client.js';

// 导出检测器
export { KeywordDetector, keywordDetector } from './detectors/keywords.js';
export { PatternDetector, patternDetector } from './detectors/pattern.js';

// 导出模块
export { SearchModule, searchModule } from './modules/search.js';
export { VideoModule, videoModule } from './modules/video.js';
export { ChannelModule, channelModule } from './modules/channel.js';
export { CommentsModule, commentsModule } from './modules/comments.js';

// 导出存储
export { YouTubeStore, ytStore } from './storage/yt-store.js';
