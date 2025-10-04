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
  if (!update.message || update.message.chat.type !== "private" || !update.message.text) {
    return;
  }

  const message = update.message;
  const privateChatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();

  const validCommands = ['/start', '/link'];
  if (!validCommands.includes(text)) {
    return;
  }

  const isMember = await checkUserInGroup(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId);
  if (!isMember) {
    await sendMessage(privateChatId, "❌ 你谁啊，为啥要给你链接？", null, env.BOT_TOKEN);
    return;
  }

  const kvKey = `link:${env.WHITELISTED_GROUP_ID}:${userId}`;
  const existingLink = await env.LINK_BOT_KV.get(kvKey);

  if (existingLink) {
    await sendMessage(privateChatId, `📎 你的链接：\n<code>${existingLink}</code>`, null, env.BOT_TOKEN);
  } else {
    try {
      const inviteLink = await createChatInviteLink(env.BOT_TOKEN, env.WHITELISTED_GROUP_ID, userId.toString());
      
      await env.LINK_BOT_KV.put(kvKey, inviteLink);
      
      await sendMessage(privateChatId, `✅ 新链接已生成，快去邀请小伙伴吧！\n\n📎 你的链接：\n<code>${inviteLink}</code>\n\n此链接永久有效，且可以无限次使用。`, null, env.BOT_TOKEN);
    } catch (error) {
      console.error("Error creating invite link:", error);
      await sendMessage(privateChatId, "⚠️ 抱歉，生成邀请链接时出现错误。请确保机器人是群组管理员并具有创建邀请链接的权限。", null, env.BOT_TOKEN);
    }
  }
}

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
    return status === 'creator' || status === 'administrator' || status === 'member';
  } catch (error) {
    console.error("Error checking group membership:", error);
    return false;
  }
}

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
