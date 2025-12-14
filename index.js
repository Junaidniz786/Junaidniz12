const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

/* ================= CONFIG ================= */

const BOT_TOKEN = "7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58";

const REQUIRED_CHANNELS = [
  "@jndtech1",
  "@Junaidniz"
];

const NUMBERS_APIS = [
  "https://www.junaidniz.pw/api/tempotps?type=numbers",
  "https://www.junaidniz.pw/api/tempotp?type=numbers"
];

const SMS_APIS = [
  "https://www.junaidniz.pw/api/tempotps?type=sms",
  "https://www.junaidniz.pw/api/tempotp?type=sms"
];

/* ================= BOT ================= */

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("✅ Bot Started");

/* userId => selected number */
const userSelectedNumber = new Map();

/* ================= COUNTRY MAP ================= */

const COUNTRY_MAP = {
  "234": { name: "Nigeria", flag: "🇳🇬" },
  "257": { name: "Burundi", flag: "🇧🇮" },
  "375": { name: "Belarus", flag: "🇧🇾" },
  "584": { name: "Venezuela", flag: "🇻🇪" }
};

function getCountryInfo(code) {
  return COUNTRY_MAP[code] || { name: "Unknown", flag: "🌍" };
}

/* ================= CHANNEL CHECK ================= */

async function isJoined(userId) {
  try {
    for (const ch of REQUIRED_CHANNELS) {
      const m = await bot.getChatMember(ch, userId);
      if (!["member", "administrator", "creator"].includes(m.status)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/* ================= START ================= */

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!(await isJoined(userId))) {
    return bot.sendMessage(chatId, "❌ Join required channels first", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Join @jndtech1", url: "https://t.me/jndtech1" }],
          [{ text: "Join @Junaidniz", url: "https://t.me/+qxDIys2tjcJhYWRk" }],
          [{ text: "✅ Verify", callback_data: "verify" }]
        ]
      }
    });
  }

  bot.sendMessage(chatId, "✅ Welcome !\n\ /numbersn ");
});

/* ================= VERIFY ================= */

bot.on("callback_query", async (q) => {
  if (q.data === "verify") {
    if (!(await isJoined(q.from.id))) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ Join channels first",
        show_alert: true
      });
    }

    bot.editMessageText("✅ Verified!\n\nUse /numbers", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id
    });
  }
});

/* ================= NUMBERS ================= */

bot.onText(/\/numbers/, async (msg) => {
  const chatId = msg.chat.id;

  for (const api of NUMBERS_APIS) {
    try {
      const { data } = await axios.get(api);
      const rows = data.aaData || [];

      for (const r of rows.slice(0, 5)) {
        const number = r[0];
        const code = String(r[1]);
        const c = getCountryInfo(code);

        await bot.sendMessage(
          chatId,
          `${c.flag} *${c.name}*\n📞 \`${number}\``,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔑 Get OTP", callback_data: `otp_${number}` }],
                [
                  { text: "🔄 Change Number", callback_data: "change_number" },
                  { text: "🌍 Change Country", callback_data: "change_country" }
                ],
                [{ text: "📢 OTP Group", url: "https://t.me/+Aqq6X6oRWCdhM2Q0" }]
              ]
            }
          }
        );
      }
      break;
    } catch {}
  }
});

/* ================= GET OTP ================= */

bot.on("callback_query", async (q) => {
  if (!q.data.startsWith("otp_")) return;

  const number = q.data.replace("otp_", "");
  userSelectedNumber.set(q.from.id, number);

  bot.answerCallbackQuery(q.id, {
    text: "⏳ Waiting for OTP...",
    show_alert: true
  });
});

/* ================= OTP LOOP ================= */

setInterval(async () => {
  for (const api of SMS_APIS) {
    try {
      const { data } = await axios.get(api);
      const rows = data.aaData || [];

      for (const r of rows) {
        const number = r[2];
        const message = r[4];

        for (const [uid, sel] of userSelectedNumber.entries()) {
          if (sel === number) {
            await bot.sendMessage(
              uid,
              `🔐 *OTP Received*\n\n📞 ${number}\n\n${message}`,
              { parse_mode: "Markdown" }
            );
            userSelectedNumber.delete(uid);
          }
        }
      }
    } catch {}
  }
}, 3000);
