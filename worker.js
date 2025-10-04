const TELEGRAM_API = "https://api.telegram.org/bot";

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      try {
        const update = await request.json();
        await handleUpdate(update, env);
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Error handling update:", error);
        return new Response("Error", { status: 500 });
      }
    }
    return new Response("Ciallo～(∠・ω< )⌒☆");
  }
};

async function handleUpdate(update, env) {
  // 只处理消息类型
  if (!update.message || !update.message.text) {
    return;
  }

  const message = update.message;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();

  // 处理私聊和群聊中的命令
  const validCommands = ['/start', '/help', '/link', '/scan', '/remake'];
  const command = text.split(' ')[0];
  
  if (!validCommands.includes(command)) {
    return;
  }

  // 处理 /start 和 /help 命令（仅在私聊中有效）
  if (command === '/start' || command === '/help') {
    if (message.chat.type !== 'private') {
      return; // 只在私聊中响应
    }
    await handleHelpCommand(chatId, env.BOT_TOKEN);
    return;
  }

  // 处理 /link 命令（仅在私聊中有效）
  if (command === '/link') {
    if (message.chat.type !== 'private') {
      return; // 只在私聊中响应
    }
    await handleLinkCommand(userId, chatId, env);
    return;
  }

  // 处理 /scan 命令（在私聊和群聊中都有效，但需要管理员权限）
  if (command === '/scan') {
    await handleScanCommand(userId, chatId, message.chat.type, env);
    return;
  }

  // 处理 /remake 命令（仅在私聊中有效）
  if (command === '/remake') {
    if (message.chat.type !== 'private') {
      return; // 只在私聊中响应
    }
    await handleRemakeCommand(userId, chatId, env);
    return;
  }
}

/**
 * 处理帮助命令
 */
async function handleHelpCommand(chatId, botToken) {
  const helpText = `<b>Intercat邀请</b>

<b>可用命令：</b>
/help - 显示帮助
/link - 获取你的邀请链接
/remake - 重新生成邀请链接（如已存在则替换旧链接）
/scan - 扫描并清理无效邀请链接（仅管理员可用）

<b>说明：</b>
1. 您必须是Intercat群组的成员才能使用此机器人
2. 每个用户只能生成一个永久有效的邀请链接
3. 使用 /remake 可以重新生成新的邀请链接，旧链接将失效`;

  await sendMessage(chatId, helpText, null, botToken);
}

/**
 * 处理链接命令
 */
async function handleLinkCommand(userId, chatId, env) {
  // 检查用户是否在指定的白名单群组中
  const isMember = await checkUserInGroup(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId);
  if (!isMember) {
    await sendMessage(chatId, "❌ 你谁啊，为啥要给你链接？", null, env.BOT_TOKEN);
    return;
  }

  // 检查用户是否已有邀请链接
  const kvKey = `link:${env.WHITELISTED_GROUP_ID}:${userId}`;
  const existingLink = await env.LINK_BOT_KV.get(kvKey);

  if (existingLink) {
    await sendMessage(chatId, `📎 你的链接：\n<code>${existingLink}</code>\n\n此链接永久有效，且可以无限次使用。\n\n如需重新生成链接，请使用 /remake 命令。`, null, env.BOT_TOKEN);
  } else {
    try {
      // 生成新的邀请链接（无限期、无限次使用）
      const inviteLink = await createChatInviteLink(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId.toString());
      
      // 将链接存储到KV，不设置过期时间
      await env.LINK_BOT_KV.put(kvKey, inviteLink);
      
      await sendMessage(chatId, `✅ 新链接已生成，快去邀请小伙伴吧！\n\n📎 你的链接：\n<code>${inviteLink}</code>\n\n此链接永久有效，且可以无限次使用。`, null, env.BOT_TOKEN);
    } catch (error) {
      console.error("Error creating invite link:", error);
      await sendMessage(chatId, "⚠️ 抱歉，生成邀请链接时出现错误。请确保机器人是群组管理员并具有创建邀请链接的权限。", null, env.BOT_TOKEN);
    }
  }
}

/**
 * 处理重新生成链接命令
 */
async function handleRemakeCommand(userId, chatId, env) {
  // 检查用户是否在指定的白名单群组中
  const isMember = await checkUserInGroup(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId);
  if (!isMember) {
    await sendMessage(chatId, "❌ 你谁啊，为啥要给你链接？", null, env.BOT_TOKEN);
    return;
  }

  const kvKey = `link:${env.WHITELISTED_GROUP_ID}:${userId}`;
  const existingLink = await env.LINK_BOT_KV.get(kvKey);

  if (!existingLink) {
    // 用户没有现有链接，引导使用 /link
    await sendMessage(chatId, "❌ 你还没有生成过邀请链接。请先使用 /link 生成你的邀请链接。", null, env.BOT_TOKEN);
    return;
  }

  try {
    // 先撤销旧的邀请链接 [6,9](@ref)
    await revokeChatInviteLink(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, existingLink);
    
    // 生成新的邀请链接
    const newInviteLink = await createChatInviteLink(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId.toString());
    
    // 更新KV中的链接
    await env.LINK_BOT_KV.put(kvKey, newInviteLink);
    
    await sendMessage(chatId, `✅ 已重新生成邀请链接！\n\n旧链接已失效，新链接如下：\n\n📎 你的新链接：\n<code>${newInviteLink}</code>`, null, env.BOT_TOKEN);
  } catch (error) {
    console.error("Error remaking invite link:", error);
    await sendMessage(chatId, "⚠️ 抱歉，重新生成邀请链接时出现错误。请稍后重试。", null, env.BOT_TOKEN);
  }
}

/**
 * 处理扫描命令（管理员专用）
 */
async function handleScanCommand(userId, chatId, chatType, env) {
  // 检查用户是否是白名单群组的管理员
  const isAdmin = await checkUserIsAdmin(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId);
  if (!isAdmin) {
    await sendMessage(chatId, "❌ 此命令仅限群组管理员使用。", null, env.BOT_TOKEN);
    return;
  }

  await sendMessage(chatId, "🔍 开始扫描无效邀请链接...", null, env.BOT_TOKEN);

  try {
    // 获取所有该群组的邀请链接记录 [9,10](@ref)
    const links = await env.LINK_BOT_KV.list({ prefix: `link:${env.WHITELISTED_GROUP_ID}:` });
    let cleanedCount = 0;
    let totalChecked = 0;
    let revokedCount = 0;

    for (const key of links.keys) {
      totalChecked++;
      // 从key中提取用户ID：link:群组ID:用户ID
      const userIdFromKey = key.name.split(':')[2];
      const existingLink = await env.LINK_BOT_KV.get(key.name);
      
      // 检查用户是否仍在群组中
      const isStillMember = await checkUserInGroup(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, parseInt(userIdFromKey));
      
      if (!isStillMember) {
        // 用户不在群组中，撤销邀请链接并删除KV记录 [6](@ref)
        if (existingLink) {
          try {
            await revokeChatInviteLink(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, existingLink);
            revokedCount++;
          } catch (revokeError) {
            console.error(`Error revoking link for user ${userIdFromKey}:`, revokeError);
          }
        }
        
        await env.LINK_BOT_KV.delete(key.name);
        cleanedCount++;
        console.log(`已清理用户 ${userIdFromKey} 的无效邀请链接`);
      }
    }

    await sendMessage(chatId, `✅ 扫描完成！\n\n检查了 ${totalChecked} 个邀请链接\n清理了 ${cleanedCount} 个无效链接\n撤销了 ${revokedCount} 个邀请链接`, null, env.BOT_TOKEN);

  } catch (error) {
    console.error("Error during scan:", error);
    await sendMessage(chatId, "⚠️ 扫描过程中出现错误，请稍后重试。", null, env.BOT_TOKEN);
  }
}

/**
 * 撤销邀请链接 [6,9](@ref)
 */
async function revokeChatInviteLink(botToken, chatId, inviteLink) {
  const response = await fetch(`${TELEGRAM_API}${botToken}/revokeChatInviteLink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      invite_link: inviteLink
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error (revoke): ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }
  
  return data.result;
}

/**
 * 检查用户是否为指定群组的成员 
 */
async function checkUserInGroup(botToken, groupChatId, userId) {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/getChatMember`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: groupChatId,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      console.error(`Telegram API error (getChatMember): ${response.status}`);
      return false;
    }

    const data = await response.json();
    if (!data.ok) {
      console.error(`Telegram API error: ${data.description}`);
      return false;
    }

    const status = data.result.status;
    return status === 'creator' || status === 'administrator' || status === 'member' || status === 'restricted';
  } catch (error) {
    console.error("Error checking group membership:", error);
    return false;
  }
}

/**
 * 检查用户是否是群组管理员 
 */
async function checkUserIsAdmin(botToken, groupChatId, userId) {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/getChatMember`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: groupChatId,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      console.error(`Telegram API error (getChatMember): ${response.status}`);
      return false;
    }

    const data = await response.json();
    if (!data.ok) {
      console.error(`Telegram API error: ${data.description}`);
      return false;
    }

    const status = data.result.status;
    return status === 'creator' || status === 'administrator';
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * 创建无限期、无限次使用的邀请链接 [2,6](@ref)
 */
async function createChatInviteLink(botToken, chatId, userId) {
  const response = await fetch(`${TELEGRAM_API}${botToken}/createChatInviteLink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      name: `invite_${userId}`,
      creates_join_request: false,
      // 不设置 member_limit 表示链接可以无限次使用 [6](@ref)
      // 不设置 expire_date 表示链接永久有效
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }
  
  return data.result.invite_link;
}

/**
 * 发送消息到Telegram 
 */
async function sendMessage(chatId, text, replyToMessageId, botToken) {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        reply_to_message_id: replyToMessageId,
        disable_web_page_preview: true,
        parse_mode: "HTML"
      })
    });

    if (!response.ok) {
      console.error("Error sending message:", await response.text());
    }
  } catch (error) {
    console.error("Error in sendMessage:", error);
  }
}
