import { YouTubeClient } from '../client.js';
import type { CommentData } from '../types.js';

/**
 * 评论模块
 */
export class CommentsModule {
  /**
   * 获取视频评论
   */
  async getComments(videoId: string, maxResults: number = 20): Promise<CommentData[]> {
    const yt = await YouTubeClient.getInstance();

    try {
      const info = await yt.getInfo(videoId);

      if (!info) {
        return [];
      }

      const comments: CommentData[] = [];

      // 获取评论
      const commentsData = await (info as any).getComments();

      if (commentsData?.contents) {
        let count = 0;

        for (const item of commentsData.contents) {
          if (item.type === 'Comment') {
            comments.push(this.parseComment(item, videoId));

            count++;
            if (maxResults && count >= maxResults) {
              break;
            }
          }
        }
      }

      return comments;
    } catch (error) {
      // 如果获取评论失败，返回空数组
      return [];
    }
  }

  /**
   * 解析评论项
   */
  private parseComment(item: any, videoId: string): CommentData {
    const author = (item as any).author;
    const commentText = item.comment?.text?.toString() || '';

    return {
      commentId: (item as any).comment_id || '',
      videoId,
      author: author?.name?.toString() || author?.title?.toString() || 'Unknown',
      authorChannelId: author?.id,
      content: commentText,
      likeCount: (item as any).vote_count || 0,
      publishDate: item.published ? new Date(item.published).toISOString() : '',
      isReply: false,
      parentId: undefined,
    };
  }

  /**
   * 搜索包含特定关键词的评论
   */
  async searchCommentsByKeyword(
    videoId: string,
    keyword: string,
    maxResults: number = 10,
  ): Promise<CommentData[]> {
    const allComments = await this.getComments(videoId, 100); // 获取更多评论

    const lowerKeyword = keyword.toLowerCase();
    const filtered = allComments.filter((c) =>
      c.content.toLowerCase().includes(lowerKeyword),
    );

    return filtered.slice(0, maxResults);
  }

  /**
   * 获取热门评论 (点赞数最多)
   */
  async getTopComments(videoId: string, maxResults: number = 10): Promise<CommentData[]> {
    const allComments = await this.getComments(videoId, 50);

    return allComments
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, maxResults);
  }
}

/**
 * 导出默认实例
 */
export const commentsModule = new CommentsModule();
