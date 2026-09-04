import { Request, Response } from 'express';
import { TwitterAccount, Mention, Reply, User, SystemSetting, TargetAccount } from '../models';
import { TwitterService } from '../services/TwitterService';
import { AgentService } from '../services/AgentService';

export class SyncController {
  
  static async runSync(accountId?: number) {
    const whereClause: any = { isActive: true };
    if (accountId) {
      whereClause.id = accountId;
    }
    
    const accounts = await TwitterAccount.findAll({ where: whereClause });
    let totalNew = 0;
    const syncErrors: string[] = [];

    const { SystemSetting } = require('../models');
    const blockedSetting = await SystemSetting.findOne({ where: { key: 'blocked_handles' } });
    const blockedHandles = blockedSetting?.value ? blockedSetting.value.split(',').map((u:string) => u.trim().toLowerCase()) : [];

    for (const account of accounts) {
      try {
        const latestMention = await Mention.findOne({
          where: { twitterAccountId: account.id },
          order: [['tweetId', 'DESC']]
        });

        const mentionsResponse = await TwitterService.fetchMentions(account.id, latestMention?.tweetId);
        
        if (mentionsResponse.data && mentionsResponse.data.data && mentionsResponse.data.data.length > 0) {
          const tweets = mentionsResponse.data.data;
          const includes = mentionsResponse.data.includes;
          
          for (const tweet of tweets) {
            let parentTweetId = null;
            let parentTweetText = null;
            const conversationId = tweet.conversation_id || null;
            let rootTweetText = null;
            
            if (tweet.referenced_tweets && tweet.referenced_tweets.length > 0) {
              const ref = tweet.referenced_tweets.find(r => r.type === 'replied_to');
              if (ref) {
                parentTweetId = ref.id;
                if (includes && includes.tweets) {
                  const parentTweet = includes.tweets.find(t => t.id === ref.id);
                  if (parentTweet) {
                    parentTweetText = parentTweet.text;
                  }
                }
              }
            }

            if (conversationId && conversationId !== parentTweetId && conversationId !== tweet.id) {
               try {
                 const client = await TwitterService.getClient(account.id);
                 const rootTweet = await client.v2.singleTweet(conversationId, { 'tweet.fields': ['text'] });
                 if (rootTweet.data) {
                   rootTweetText = rootTweet.data.text;
                 }
               } catch (rootErr) {
                 console.error('Could not fetch root tweet:', rootErr);
               }
            }

            let authorUsername = 'unknown';
            let authorProfileImageUrl = null;
            if (includes && includes.users) {
              const author = includes.users.find(u => u.id === tweet.author_id);
              if (author) {
                authorUsername = author.username;
                authorProfileImageUrl = author.profile_image_url || null;
              }
            }
            
            // SKIP IF BLOCKED
            if (blockedHandles.includes(authorUsername.toLowerCase())) {
               continue;
            }

            let mediaUrls = null;
            if (tweet.attachments && tweet.attachments.media_keys && includes && includes.media) {
              const attachedMedia = includes.media.filter(m => tweet.attachments.media_keys.includes(m.media_key));
              if (attachedMedia.length > 0) {
                mediaUrls = attachedMedia.map(m => m.url || m.preview_image_url).filter(Boolean);
              }
            }

            const [mentionRecord, created] = await Mention.findOrCreate({
              where: { tweetId: tweet.id },
              defaults: {
                twitterAccountId: account.id,
                tweetId: tweet.id,
                authorUsername,
                authorProfileImageUrl,
                mediaUrls,
                text: tweet.text,
                parentTweetId,
                parentTweetText,
                conversationId,
                rootTweetText
              }
            });
            
            if (created) {
              totalNew++;
              
              // Handle AI Drafts
              if (account.replyMode === 'DRAFT_ONLY' || account.replyMode === 'AUTO') {
                try {
                  // Check System Settings for context mode
                  const contextSetting = await SystemSetting.findOne({ where: { key: 'ai_context_mode' } });
                  const aiContextMode = contextSetting?.value || 'THREAD';
                  
                  let aiPromptContext = "";
                  if (aiContextMode === 'THREAD') {
                    if (rootTweetText) aiPromptContext += `Conversation Thread Started With: "${rootTweetText}"\n\n`;
                    if (parentTweetText) aiPromptContext += `Directly Replying To: "${parentTweetText}"\n\n`;
                  }
                  aiPromptContext += `User's Mention To You: "${tweet.text}"`;

                  const replyText = await AgentService.generateReply(aiPromptContext);
                  
                  if (account.replyMode === 'DRAFT_ONLY') {
                    await mentionRecord.update({ draftText: replyText });
                  } else if (account.replyMode === 'AUTO') {
                    try {
                      // Actually send it to Twitter
                      await TwitterService.replyToTweet(account.id, mentionRecord.tweetId, replyText);
                      
                      // Get a system user to attach the reply to
                      const [systemUser] = await User.findOrCreate({
                        where: { role: 'AI_BOT' },
                        defaults: {
                          username: 'VipiBot',
                          fullName: 'Vipi AI Co-Pilot',
                          email: 'bot@vipi.ai',
                          initials: 'AI',
                          passwordHash: 'auto_generated_ai_no_login',
                          role: 'AI_BOT',
                          isActive: true,
                        }
                      });
                      
                      // Save the reply record
                      await Reply.create({
                        mentionId: mentionRecord.id,
                        userId: systemUser ? systemUser.id : 1,
                        replyText: replyText
                      });
                      
                      // Update mention to REPLIED
                      await mentionRecord.update({ draftText: replyText, status: 'REPLIED' });
                      console.log(`[AUTO-PILOT] Successfully replied to ${mentionRecord.tweetId}`);
                      
                      const { UserActivityLog } = require('../models');
                      await UserActivityLog.create({
                        userId: systemUser.id,
                        action: 'Auto-Reply (Mention)',
                        details: { tweetId: mentionRecord.tweetId, text: replyText }
                      });
                    } catch (replyErr: any) {
                      console.error(`Failed to auto-reply to ${mentionRecord.tweetId}:`, replyErr);
                      syncErrors.push(`@${account.handle} Auto-reply failed: ${replyErr.message || String(replyErr)}`);
                      // Still save draft so user can manually retry
                      await mentionRecord.update({ draftText: replyText });
                    }
                  }
                } catch (aiErr) {
                  console.error('AI Draft Error:', aiErr);
                  syncErrors.push(`@${account.handle} AI generation failed`);
                }
              }
            }
          }
        }
      } catch (accountError: any) {
        console.error(`Error syncing account ${account.handle}:`, accountError);
        let errMessage = accountError.message || String(accountError);
        if (accountError.data && accountError.data.detail) {
           errMessage = accountError.data.detail;
        } else if (accountError.data && accountError.data.title) {
           errMessage = accountError.data.title;
        }
        syncErrors.push(`@${account.handle}: ${errMessage}`);
      }
    }
    
    return { totalNew, syncErrors };
  }


  static async syncTargets() {
    console.log('[CRON] Starting Target Account auto-responder sync...');
    try {
      const targets = await TargetAccount.findAll({ where: { isActive: true }, include: [{ model: TwitterAccount }] });
      
      const aiContextModeSetting = await SystemSetting.findOne({ where: { key: 'ai_context_mode' } });
      const contextMode = aiContextModeSetting ? aiContextModeSetting.value : 'THREAD';

      for (const target of targets) {
        if (!target.TwitterAccount) continue;
        
        console.log(`[CRON] Checking target ${target.handle} for new tweets...`);
        const client = await TwitterService.getClient(target.ownerAccountId);
        
        let timeline;
        try {
           timeline = await client.v2.userTimeline(target.twitterId, {
             max_results: 5,
             since_id: target.lastProcessedTweetId || undefined,
             exclude: ['retweets', 'replies']
           });
        } catch(e) {
           console.log(`[CRON] Failed to fetch timeline for target ${target.handle}`, e.message);
           continue;
        }

        if (!timeline.data || !timeline.data.data || timeline.data.data.length === 0) {
           continue;
        }
        
        const newTweets = timeline.data.data.reverse();
        
        for (const tweet of newTweets) {
           console.log(`[CRON] Found new target tweet ${tweet.id} from ${target.handle}. Auto-replying...`);
           
           try {
             const aiPromptContext = `Target Account (${target.handle}) tweeted: "${tweet.text}"`;
             const aiReply = await AgentService.generateReply(aiPromptContext, target.tone || undefined);
             
             // Send Reply
             const fullReply = `${aiReply} ^bot`;
             const postRes = await TwitterService.postTweet(target.ownerAccountId, fullReply, tweet.id);
             
             console.log(`[CRON] Auto-replied to ${target.handle} successfully.`);
             
             // Save last processed ID so we don't reply again
             target.lastProcessedTweetId = tweet.id;
             await target.save();
           } catch (replyErr) {
             console.error(`[CRON] Error auto-replying to ${target.handle} tweet ${tweet.id}:`, replyErr.message);
           }
        }
      }
    } catch (err) {
      console.error('[CRON] Error in syncTargets:', err);
    }
  }

  static async syncMentions(req: Request, res: Response) {
    try {
      const { accountId } = req.body;
      const result = await SyncController.runSync(accountId);
      res.json({ message: 'Sync complete', newMentions: result.totalNew, errors: result.syncErrors });
    } catch (error) {
      res.status(500).json({ message: 'Error syncing mentions', error });
    }
  }
}
