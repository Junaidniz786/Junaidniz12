const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const phonenumbers = require("google-libphonenumber");

const BOT_TOKEN = process.env.BOT_TOKEN;
if (7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58) {
  console.error("❌ BOT_TOKEN missing");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ===== CONFIG =====
const REQUIRED_CHANNELS = ["@jndtech1", "@Junaidniz"];

const NUMBER_APIS = [
  "https://www.junaidniz.pw/api/tempotps?type=numbers",
  "https://www.junaidniz.pw/api/tempotp?type=numbers",
];

const SMS_APIS = [
  "https://www.junaidniz.pw/api/tempotps?type=sms",
  "https://www.junaidniz.pw/api/tempotp?type=sms",
];

const GROUP_IDS = [
  -1003361941052 // ← apna OTP group ID yahan daalo
];

// ===== MEMORY =====
const users = new Map(); // userId -> { country, number, messageId }

// ===== UTIL =====
function cleanNumber(n) {
  return String(n).replace(/[^0-9]/g, "");
}

function getFlag(regionCode) {
  if (!regionCode) return "🌍";
  const base = 127462 - 65;
  return String.fromCodePoint(
    base + regionCode.charCodeAt(0),
    base + regionCode.charCodeAt(1)
  );
}

function getCountryFromNumber(number) {
  try {
    const phoneUtil = phonenumbers.PhoneNumberUtil.getInstance();
    const parsed = phoneUtil.parse("+" + number);
    const region = phoneUtil.getRegionCodeForNumber(parsed);
    return {
      country: region,
      flag: getFlag(region),
    };
  } catch {
    return { country: "Unknown", flag: "🌍" };
  }
}

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

// ===== START =====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!(await isJoined(userId))) {
    return bot.sendMessage(chatId, "❌ Join required channels first", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Join Channel", url: "https://t.me/jndtech1" }],
          [{ text: "Join Group", url: "https://t.me/Junaidniz" }],
          [{ text: "✅ Verify", callback_data: "verify" }],
        ],
      },
    });
  }

  sendCountryMenu(chatId, true);
});

// ===== VERIFY =====
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  if (q.data === "verify") {
    if (!(await isJoined(userId))) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ Join channels first",
        show_alert: true,
      });
    }
    sendCountryMenu(chatId, true);
  }

  if (q.data.startsWith("country_")) {
    const country = q.data.replace("country_", "");
    users.set(userId, { country });
    sendNumber(chatId, userId, true);
  }

  if (q.data === "change_number") {
    sendNumber(chatId, userId, false);
  }

  if (q.data === "change_country") {
    sendCountryMenu(chatId, false);
  }
});

// ===== COUNTRY MENU =====
async function sendCountryMenu(chatId, fresh) {
  const countries = new Set();

  for (const api of NUMBER_APIS) {
    try {
      const { data } = await axios.get(api);
      (data.aaData || []).forEach(r => {
        const num = cleanNumber(r[2]);
        const info = getCountryFromNumber(num);
        if (info.country !== "Unknown") {
          countries.add(info.country);
        }
      });
    } catch {}
  }

  const buttons = [...countries].map(c => {
    const flag = getFlag(c);
    return [{ text: `${flag} ${c}`, callback_data: `country_${c}` }];
  });

  bot.sendMessage(chatId, "🌍 Select Country:", {
    reply_markup: { inline_keyboard: buttons },
  });
}

// ===== SEND NUMBER =====
async function sendNumber(chatId, userId, freshMsg) {
  const state = users.get(userId);
  if (!state?.country) return;

  let selected = null;

  for (const api of NUMBER_APIS) {
    try {
      const { data } = await axios.get(api);
      const rows = data.aaData || [];
      for (const r of rows) {
        const num = cleanNumber(r[2]);
        const info = getCountryFromNumber(num);
        if (info.country === state.country) {
          selected = { number: num, ...info };
          break;
        }
      }
      if (selected) break;
    } catch {}
  }

  if (!selected) {
    return bot.sendMessage(chatId, "❌ No number available");
  }

  users.set(userId, { ...state, number: selected.number });

  const text = `
📱 <b>Your Number (${state.country})</b>
${selected.flag} +${selected.number}

⏳ Waiting for OTP...
🔔 You'll get notified instantly!
`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔁 Change Number", callback_data: "change_number" }],
      [{ text: "🌍 Change Country", callback_data: "change_country" }],
      [{ text: "📢 OTP Group", url: "https://t.me/+Aqq6X6oRWCdhM2Q0" }],
    ],
  };

  if (freshMsg || !state.messageId) {
    const m = await bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    users.get(userId).messageId = m.message_id;
  } else {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: state.messageId,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }
}

// ===== OTP LOOP (GROUP FORMAT) =====
setInterval(async () => {
  for (const api of SMS_APIS) {
    try {
      const { data } = await axios.get(api);
      for (const r of data.aaData || []) {
        const number = cleanNumber(r[2]);
        const msg = r[4];
        const otp = msg.match(/\b\d{4,8}\b/)?.[0];
        if (!otp) continue;

        const info = getCountryFromNumber(number);

        const text = `
<b>${info.flag} New OTP Received</b>

🕰 Time: ${r[0]}
🌍 Country: ${info.country}
📞 Number: ${number.slice(0,5)}****${number.slice(-3)}
🔑 OTP: <code>${otp}</code>

📩 Message:
${msg}
`;

        for (const g of GROUP_IDS) {
          await bot.sendMessage(g, text, { parse_mode: "HTML" });
        }
      }
    } catch {}
  }
}, 3000);

console.log("✅ Junaid Niz OTP Bot Running");
