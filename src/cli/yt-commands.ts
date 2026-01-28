import { Command } from 'commander';
import { CLIOutput } from '../utils/output.js';
import { searchModule } from '../youtube-scraper/modules/search.js';
import { videoModule } from '../youtube-scraper/modules/video.js';
import { channelModule } from '../youtube-scraper/modules/channel.js';
import { ytStore } from '../youtube-scraper/storage/yt-store.js';
import { YouTubeClient } from '../youtube-scraper/client.js';
import type { VideoData, ChannelData } from '../youtube-scraper/types.js';

/**
 * 格式化数字 (1.2K, 1.5M)
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * 格式化时长
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 显示视频列表
 */
function displayVideos(videos: VideoData[], showAI: boolean = false): void {
  if (videos.length === 0) {
    CLIOutput.warn('没有找到视频');
    return;
  }

  CLIOutput.keyValue('找到视频', videos.length.toString());

  for (const video of videos) {
    console.log('');

    // AI 标记
    if (video.aiDetection.isAI) {
      const confidence = Math.round(video.aiDetection.confidence * 100);
      console.log(
        CLIOutput.badge(`AI ${confidence}%`, video.aiDetection.confidence > 0.8 ? 'green' : 'yellow'),
      );
    }

    CLIOutput.keyValue('ID', video.videoId);
    CLIOutput.keyValue('标题', video.title.substring(0, 60) + (video.title.length > 60 ? '...' : ''));

    if (showAI && video.aiDetection.isAI) {
      if (video.aiDetection.detectedTool) {
        CLIOutput.keyValue('AI 工具', video.aiDetection.detectedTool);
      }
      if (video.aiDetection.matchedKeywords.length > 0) {
        CLIOutput.keyValue('关键词', video.aiDetection.matchedKeywords.slice(0, 3).join(', '));
      }
    }

    CLIOutput.keyValue('频道', video.channel.name);
    CLIOutput.keyValue('观看', formatNumber(video.viewCount));
    CLIOutput.keyValue('时长', formatDuration(video.duration));
    CLIOutput.keyValue('发布', video.publishDate ? video.publishDate.split('T')[0] : 'N/A');
  }
}

/**
 * 显示频道信息
 */
function displayChannel(channel: ChannelData): void {
  CLIOutput.subtitle('频道信息');
  CLIOutput.keyValue('ID', channel.channelId);
  CLIOutput.keyValue('名称', channel.name);
  CLIOutput.keyValue('Handle', channel.handle);
  CLIOutput.keyValue('订阅数', formatNumber(channel.subscriberCount));
  CLIOutput.keyValue('视频数', formatNumber(channel.videoCount));
  CLIOutput.keyValue('认证', channel.isVerified ? '是' : '否');
  if (channel.description) {
    CLIOutput.keyValue('简介', channel.description.substring(0, 100) + '...');
  }
}

/**
 * 注册 YouTube 命令
 */
export function registerYouTubeCommands(program: Command): void {
  /**
   * 搜索命令
   */
  program
    .command('yt-search <query>')
    .description('搜索 YouTube 视频')
    .option('-m, --max <number>', '最大结果数', '20')
    .option('-a, --ai-only', '只显示 AI 视频')
    .option('-s, --save', '保存到本地')
    .action(async (query: string, options: { max: string; aiOnly: boolean; save: boolean }) => {
      CLIOutput.title('搜索 YouTube 视频');

      try {
        const maxResults = parseInt(options.max, 10);
        const result = await searchModule.search({
          query,
          maxResults,
          aiOnly: options.aiOnly,
        });

        displayVideos(result.videos, options.aiOnly);

        // 保存选项
        if (options.save && result.videos.length > 0) {
          await ytStore.saveVideos(result.videos);
          console.log('');
          CLIOutput.success(`已保存 ${result.videos.length} 个视频到本地`);
        }
      } catch (error) {
        CLIOutput.error(`搜索失败: ${error}`);
      }
    });

  /**
   * 视频详情命令
   */
  program
    .command('yt-video <videoId>')
    .description('获取视频详情')
    .option('-s, --save', '保存到本地')
    .action(async (videoId: string, options: { save: boolean }) => {
      CLIOutput.title('获取视频详情');

      try {
        const video = await videoModule.getVideo(videoId);

        if (!video) {
          CLIOutput.error(`找不到视频: ${videoId}`);
          return;
        }

        console.log('');
        CLIOutput.subtitle('基本信息');
        CLIOutput.keyValue('ID', video.videoId);
        CLIOutput.keyValue('标题', video.title);
        CLIOutput.keyValue('频道', video.channel.name);
        CLIOutput.keyValue('观看数', formatNumber(video.viewCount));
        CLIOutput.keyValue('点赞数', formatNumber(video.likeCount));
        CLIOutput.keyValue('评论数', formatNumber(video.commentCount));
        CLIOutput.keyValue('时长', formatDuration(video.duration));
        CLIOutput.keyValue('发布日期', video.publishDate.split('T')[0]);

        // AI 检测结果
        console.log('');
        CLIOutput.subtitle('AI 检测');
        if (video.aiDetection.isAI) {
          const confidence = Math.round(video.aiDetection.confidence * 100);
          CLIOutput.keyValue('AI 内容', `是 (${confidence}%)`);

          if (video.aiDetection.detectedTool) {
            CLIOutput.keyValue('检测工具', video.aiDetection.detectedTool);
          }

          if (video.aiDetection.matchedKeywords.length > 0) {
            CLIOutput.keyValue('匹配关键词', video.aiDetection.matchedKeywords.join(', '));
          }

          if (video.aiDetection.detectedPatterns.length > 0) {
            CLIOutput.keyValue('匹配模式', video.aiDetection.detectedPatterns.join(', '));
          }
        } else {
          CLIOutput.keyValue('AI 内容', '否');
        }

        // 标签
        if (video.tags && video.tags.length > 0) {
          console.log('');
          CLIOutput.subtitle('标签');
          CLIOutput.list(video.tags.slice(0, 10));
        }

        // 描述预览
        if (video.description) {
          console.log('');
          CLIOutput.subtitle('描述');
          CLIOutput.quote(video.description.substring(0, 300) + '...');
        }

        // 保存选项
        if (options.save) {
          await ytStore.saveVideo(video);
          console.log('');
          CLIOutput.success('视频已保存到本地');
        }
      } catch (error) {
        CLIOutput.error(`获取失败: ${error}`);
      }
    });

  /**
   * 频道详情命令
   */
  program
    .command('yt-channel <channelId>')
    .description('获取频道信息')
    .option('-v, --videos <number>', '获取最新 N 个视频', '10')
    .option('-s, --save', '保存到本地')
    .action(async (channelId: string, options: { videos: string; save: boolean }) => {
      CLIOutput.title('获取频道信息');

      try {
        const channel = await channelModule.getChannel(channelId);

        if (!channel) {
          CLIOutput.error(`找不到频道: ${channelId}`);
          return;
        }

        displayChannel(channel);

        // 获取频道视频
        const videoCount = parseInt(options.videos, 10);
        if (videoCount > 0) {
          const videoIds = await channelModule.getChannelVideos(channelId, videoCount);

          if (videoIds.length > 0) {
            console.log('');
            CLIOutput.subtitle(`最新视频 (${videoIds.length})`);

            for (const vid of videoIds) {
              CLIOutput.keyValue('视频 ID', vid);
            }
          }
        }

        // 保存选项
        if (options.save) {
          await ytStore.saveChannel(channel);
          console.log('');
          CLIOutput.success('频道已保存到本地');
        }
      } catch (error) {
        CLIOutput.error(`获取失败: ${error}`);
      }
    });

  /**
   * 批量采集命令
   */
  program
    .command('yt-collect')
    .description('批量采集 AI 视频')
    .option('-q, --query <query>', '搜索查询', 'AI generated video')
    .option('-m, --max <number>', '最大采集数', '50')
    .option('-c, --collection <name>', '收藏集合名称')
    .action(async (options: { query: string; max: string; collection?: string }) => {
      CLIOutput.title('批量采集 AI 视频');

      const maxResults = parseInt(options.max, 10);

      try {
        // 搜索视频
        CLIOutput.info(`搜索: ${options.query}`);
        const result = await searchModule.search({
          query: options.query,
          maxResults,
          aiOnly: true,
        });

        CLIOutput.success(`找到 ${result.videos.length} 个 AI 视频`);

        if (result.videos.length === 0) {
          return;
        }

        // 保存视频
        CLIOutput.info('保存视频数据...');
        await ytStore.saveVideos(result.videos);

        // 创建或添加到收藏集合
        if (options.collection) {
          CLIOutput.info(`创建收藏集合: ${options.collection}`);

          const collection = await ytStore.createCollection(
            options.collection,
            options.query,
            `AI 视频收藏 - ${new Date().toISOString().split('T')[0]}`,
          );

          const videoIds = result.videos.map((v) => v.videoId);
          await ytStore.addVideosToCollection(collection.id, videoIds);

          CLIOutput.success(`收藏集合已创建: ${collection.id}`);
        }

        // 显示统计
        const stats = await ytStore.getStats();
        console.log('');
        CLIOutput.subtitle('存储统计');
        CLIOutput.keyValue('总视频数', stats.totalVideos.toString());
        CLIOutput.keyValue('AI 视频数', stats.aiVideos.toString());
        CLIOutput.keyValue('总频道数', stats.totalChannels.toString());
        CLIOutput.keyValue('存储大小', `${Math.round(stats.storageSize / 1024)} KB`);

        CLIOutput.success('采集完成');
      } catch (error) {
        CLIOutput.error(`采集失败: ${error}`);
      }
    });

  /**
   * 列出已采集视频命令
   */
  program
    .command('yt-list')
    .description('列出已采集的视频')
    .option('-a, --ai-only', '只显示 AI 视频')
    .option('-t, --tool <tool>', '按 AI 工具筛选')
    .option('-k, --keyword <keyword>', '按关键词搜索')
    .action(async (options: { aiOnly: boolean; tool?: string; keyword?: string }) => {
      CLIOutput.title('已采集视频列表');

      try {
        let videos: VideoData[];

        if (options.keyword) {
          videos = await ytStore.searchVideos(options.keyword);
          CLIOutput.info(`关键词: ${options.keyword}`);
        } else if (options.tool) {
          videos = await ytStore.searchByTool(options.tool);
          CLIOutput.info(`AI 工具: ${options.tool}`);
        } else if (options.aiOnly) {
          videos = await ytStore.listAIVideos();
          CLIOutput.info('只显示 AI 视频');
        } else {
          videos = await ytStore.listVideos();
        }

        displayVideos(videos, true);
      } catch (error) {
        CLIOutput.error(`获取列表失败: ${error}`);
      }
    });

  /**
   * 统计命令
   */
  program
    .command('yt-stats')
    .description('显示 YouTube 数据统计')
    .action(async () => {
      CLIOutput.title('YouTube 数据统计');

      try {
        const stats = await ytStore.getStats();

        CLIOutput.subtitle('存储统计');
        CLIOutput.keyValue('总视频数', stats.totalVideos.toString());
        CLIOutput.keyValue('AI 视频数', stats.aiVideos.toString());
        CLIOutput.keyValue('AI 比例', stats.totalVideos > 0
          ? `${Math.round((stats.aiVideos / stats.totalVideos) * 100)}%`
          : 'N/A');
        CLIOutput.keyValue('总频道数', stats.totalChannels.toString());
        CLIOutput.keyValue('收藏集合数', stats.totalCollections.toString());
        CLIOutput.keyValue('存储大小', `${Math.round(stats.storageSize / 1024)} KB`);

        // 列出收藏集合
        if (stats.totalCollections > 0) {
          const collections = await ytStore.listCollections();
          console.log('');
          CLIOutput.subtitle('收藏集合');

          for (const coll of collections) {
            CLIOutput.keyValue(coll.name, `${coll.videoIds.length} 个视频`);
          }
        }
      } catch (error) {
        CLIOutput.error(`获取统计失败: ${error}`);
      }
    });

  /**
   * 测试连接命令
   */
  program
    .command('yt-ping')
    .description('测试 YouTube API 连接')
    .action(async () => {
      CLIOutput.title('测试 YouTube API 连接');

      try {
        const isHealthy = await YouTubeClient.ping();

        if (isHealthy) {
          CLIOutput.success('YouTube API 连接正常');
        } else {
          CLIOutput.error('YouTube API 连接失败');
        }
      } catch (error) {
        CLIOutput.error(`连接测试失败: ${error}`);
      }
    });
}
