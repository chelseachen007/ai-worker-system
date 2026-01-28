import { Command } from 'commander';
import { CLIOutput } from '../utils/output.js';
import { searchModule } from '../youtube-scraper/modules/search.js';
import { ytStore } from '../youtube-scraper/storage/yt-store.js';
import type { VideoData } from '../youtube-scraper/types.js';

/**
 * 显示视频
 */
function showVideos(videos: VideoData[]): void {
  if (videos.length === 0) {
    CLIOutput.warn('没有视频');
    return;
  }

  CLIOutput.keyValue('数量', videos.length.toString());
  for (const v of videos) {
    console.log('');
    if (v.aiDetection.isAI) {
      console.log(CLIOutput.badge('AI', 'green'));
    }
    CLIOutput.keyValue('ID', v.videoId);
    CLIOutput.keyValue('标题', v.title.substring(0, 50) + '...');
    CLIOutput.keyValue('频道', v.channel.name);
  }
}

/**
 * 注册 YouTube 命令
 */
export function registerYouTubeCommands(program: Command): void {
  /**
   * 搜索
   */
  program
    .command('yt <query>')
    .alias('y')
    .option('-m, --max <n>', '数量', '10')
    .option('-s, --save', '保存')
    .action(async (query: string, options: { max: string; save: boolean }) => {
      try {
        const result = await searchModule.search({
          query,
          maxResults: parseInt(options.max),
          aiOnly: true,
        });

        showVideos(result.videos);

        if (options.save && result.videos.length > 0) {
          await ytStore.saveVideos(result.videos);
          CLIOutput.success(`已保存 ${result.videos.length} 个`);
        }
      } catch (error) {
        CLIOutput.error(`搜索失败: ${error}`);
      }
    });

  /**
   * 列表
   */
  program
    .command('ytl')
    .description('已采集视频')
    .action(async () => {
      const videos = await ytStore.listAIVideos();
      showVideos(videos);
    });

  /**
   * 统计
   */
  program
    .command('yts')
    .description('YouTube 统计')
    .action(async () => {
      const stats = await ytStore.getStats();
      CLIOutput.keyValue('视频', stats.totalVideos.toString());
      CLIOutput.keyValue('AI', stats.aiVideos.toString());
      CLIOutput.keyValue('存储', `${Math.round(stats.storageSize / 1024)} KB`);
    });
}
