// worker.js
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
  if (!update.message || !update.message.text) return;

  const message = update.message;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();
  const chatType = message.chat.type;
  const messageId = message.message_id;

  const command = parseCommand(text, env.BOT_USERNAME);
  if (!command) return;

  if (command === '/start') {
    if (chatType !== 'private') {
      await sendMessage(chatId, `👋 请私聊我使用该命令: @${env.BOT_USERNAME}`, messageId, env.BOT_TOKEN);
      return;
    }
    await handleStartCommand(chatId, messageId, env.BOT_TOKEN);
    return;
  }

  if (command === '/help') {
    await handleHelpCommand(chatId, messageId, env.BOT_TOKEN);
    return;
  }

  if (command === '/link') {
    if (chatType !== 'private') {
      await sendMessage(chatId, `👋 请私聊我使用该命令: @${env.BOT_USERNAME}`, messageId, env.BOT_TOKEN);
      return;
    }
    await handleLinkCommand(userId, chatId, messageId, env);
    return;
  }

  if (command === '/remake') {
    if (chatType !== 'private') {
      await sendMessage(chatId, `👋 请私聊我使用该命令: @${env.BOT_USERNAME}`, messageId, env.BOT_TOKEN);
      return;
    }
    await handleRemakeCommand(userId, chatId, messageId, env);
    return;
  }

  if (command === '/scan') {
    await handleScanCommand(userId, chatId, chatType, messageId, env);
    return;
  }
}

function parseCommand(text, botUsername) {
  if (!text.startsWith('/')) return null;

  const parts = text.split(' ')[0].split('@');
  const command = parts[0];
  
  if (parts.length > 1 && parts[1] !== botUsername) return null;
  
  return command;
}

async function handleStartCommand(chatId, replyToMessageId, botToken) {
  const startText = `
  <b>可用命令：</b>
  /help - 查看帮助
  /link - 获取您的专属邀请链接
  /remake - 重新生成邀请链接
  
  <b>注意事项：</b>
  • 每个用户只能拥有一个有效链接
  • 链接永久有效且无使用次数限制
  • 重新生成链接后旧链接立即失效`;
  
  await sendMessage(chatId, startText, replyToMessageId, botToken);
}

async function handleHelpCommand(chatId, replyToMessageId, botToken) {
  const helpText = `
  <b>可用命令：</b>
  /help - 查看帮助
  /link - 获取您的专属邀请链接
  /remake - 重新生成邀请链接
  
  <b>注意事项：</b>
  • 每个用户只能拥有一个有效链接
  • 链接永久有效且无使用次数限制
  • 重新生成链接后旧链接立即失效`;

  await sendMessage(chatId, helpText, replyToMessageId, botToken);
}

async function handleLinkCommand(userId, chatId, replyToMessageId, env) {
  const isMember = await checkUserInGroup(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId);
  if (!isMember) {
    await sendMessage(chatId, "❌ 你谁啊，为啥要给你链接？", replyToMessageId, env.BOT_TOKEN);
    return;
  }

  const kvKey = `link:${env.WHITELISTED_GROUP_ID}:${userId}`;
  const existingLink = await env.LINK_BOT_KV.get(kvKey);

  if (existingLink) {
    await sendMessage(chatId, `📎 你的专属链接：\n<code>${existingLink}</code>\n\n此链接永久有效，可无限次使用。\n如需重新生成，请使用 /remake 命令。`, replyToMessageId, env.BOT_TOKEN);
  } else {
    try {
      const inviteLink = await createChatInviteLink(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId.toString());
      await env.LINK_BOT_KV.put(kvKey, inviteLink);
      await sendMessage(chatId, `✅ 新链接已生成！\n\n📎 你的专属链接：\n<code>${inviteLink}</code>\n\n此链接永久有效，可无限次使用。`, replyToMessageId, env.BOT_TOKEN);
    } catch (error) {
      console.error("Error creating invite link:", error);
      await sendMessage(chatId, "⚠️ 生成链接时出现错误，请稍后重试", replyToMessageId, env.BOT_TOKEN);
    }
  }
}

async function handleRemakeCommand(userId, chatId, replyToMessageId, env) {
  const isMember = await checkUserInGroup(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId);
  if (!isMember) {
    await sendMessage(chatId, "❌ 你谁啊，为啥要给你链接？", replyToMessageId, env.BOT_TOKEN);
    return;
  }

  const kvKey = `link:${env.WHITELISTED_GROUP_ID}:${userId}`;
  const existingLink = await env.LINK_BOT_KV.get(kvKey);

  if (!existingLink) {
    await sendMessage(chatId, "❌ 你还没有生成过邀请链接，请先使用 /link 命令", replyToMessageId, env.BOT_TOKEN);
    return;
  }

  try {
    await revokeChatInviteLink(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, existingLink);
    const newInviteLink = await createChatInviteLink(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId.toString());
    await env.LINK_BOT_KV.put(kvKey, newInviteLink);
    await sendMessage(chatId, `✅ 链接已重新生成！\n\n📎 你的新链接：\n<code>${newInviteLink}</code>\n\n旧链接已失效，请使用新链接邀请好友。`, replyToMessageId, env.BOT_TOKEN);
  } catch (error) {
    console.error("Error remaking invite link:", error);
    await sendMessage(chatId, "⚠️ 重新生成链接时出现错误，请稍后重试", replyToMessageId, env.BOT_TOKEN);
  }
}

async function handleScanCommand(userId, chatId, chatType, replyToMessageId, env) {
  const isAdmin = await checkUserIsAdmin(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId);
  if (!isAdmin) {
    await sendMessage(chatId, "❌ 此命令仅限群组管理员使用", replyToMessageId, env.BOT_TOKEN);
    return;
  }

  await sendMessage(chatId, "🔍 开始扫描无效邀请链接...", replyToMessageId, env.BOT_TOKEN);

  try {
    const links = await env.LINK_BOT_KV.list({ prefix: `link:${env.WHITELISTED_GROUP_ID}:` });
    let cleanedCount = 0;
    let totalChecked = 0;
    let revokedCount = 0;

    for (const key of links.keys) {
      totalChecked++;
      const userIdFromKey = key.name.split(':')[2];
      const existingLink = await env.LINK_BOT_KV.get(key.name);
      
      const isStillMember = await checkUserInGroup(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, parseInt(userIdFromKey));
      
      if (!isStillMember) {
        if (existingLink) {
          try {
            await revokeChatInviteLink(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, existingLink);
            revokedCount++;
          } catch (revokeError) {
            console.error(`Error revoking link:`, revokeError);
          }
        }
        await env.LINK_BOT_KV.delete(key.name);
        cleanedCount++;
      }
    }

    await sendMessage(chatId, `✅ 扫描完成！\n检查: ${totalChecked} | 清理: ${cleanedCount} | 撤销: ${revokedCount}`, replyToMessageId, env.BOT_TOKEN);

  } catch (error) {
    console.error("Scan error:", error);
    await sendMessage(chatId, "⚠️ 扫描过程中出现错误，请稍后重试", replyToMessageId, env.BOT_TOKEN);
  }
}

async function checkUserInGroup(botToken, groupChatId, userId) {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: groupChatId, user_id: userId }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (!data.ok) return false;

    const status = data.result.status;
    return status === 'creator' || status === 'administrator' || status === 'member' || status === 'restricted';
  } catch (error) {
    console.error("Check membership error:", error);
    return false;
  }
}

async function checkUserIsAdmin(botToken, groupChatId, userId) {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: groupChatId, user_id: userId }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (!data.ok) return false;

    const status = data.result.status;
    return status === 'creator' || status === 'administrator';
  } catch (error) {
    console.error("Check admin error:", error);
    return false;
  }
}

async function createChatInviteLink(botToken, chatId, userId) {
  const response = await fetch(`${TELEGRAM_API}${botToken}/createChatInviteLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      name: `invite_${userId}`,
      creates_join_request: false,
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.ok) throw new Error(`API error: ${data.description}`);
  
  return data.result.invite_link;
}

async function revokeChatInviteLink(botToken, chatId, inviteLink) {
  const response = await fetch(`${TELEGRAM_API}${botToken}/revokeChatInviteLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, invite_link: inviteLink })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Revoke error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.ok) throw new Error(`API error: ${data.description}`);
  
  return data.result;
}

async function sendMessage(chatId, text, replyToMessageId, botToken) {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        reply_to_message_id: replyToMessageId,
        disable_web_page_preview: true,
        parse_mode: "HTML"
      })
    });

    if (!response.ok) {
      console.error("Send message error:", await response.text());
    }
  } catch (error) {
    console.error("Send message error:", error);
  }
}
