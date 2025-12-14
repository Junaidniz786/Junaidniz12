const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

/* ================= CONFIG ================= */

const BOT_TOKEN = "8550802106:AAHhbkIS8Svn5_6qjlT8xmKUbhsZVY_YT2Q";

const REQUIRED_CHANNELS = [
  "@jndtech1",
  "@jndtech1"
];

// OTP GROUP (replace with real id)
const OTP_GROUP_ID = -100XXXXXXXXXX;

// APIs
const NUMBERS_API = "https://www.junaidniz.pw/api/tempotp?type=numbers";
const SMS_API     = "https://www.junaidniz.pw/api/tempotp?type=sms";

/* ========================================== */

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("✅ BOT STARTED");

const userState = new Map();

/* ================= JOIN CHECK ================= */

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

/* ================= COUNTRY UTILS ================= */

function cleanCountry(raw) {
  if (!raw) return null;
  let c = String(raw);
  c = c.split("-")[0];
  const d = c.search(/[0-9]/);
  if (d !== -1) c = c.slice(0, d);
  return c.trim();
}

function countryFlag(name) {
  try {
    const map = {
      Nigeria:"🇳🇬", Venezuela:"🇻🇪", Belarus:"🇧🇾", Burundi:"🇧🇮",
      Pakistan:"🇵🇰", India:"🇮🇳", Bangladesh:"🇧🇩", Ukraine:"🇺🇦",
      Morocco:"🇲🇦", Ethiopia:"🇪🇹", Afghanistan:"🇦🇫", Nepal:"🇳🇵",
      Tajikistan:"🇹🇯", Kyrgyzstan:"🇰🇬", Comoros:"🇰🇲",
      "Burkina Faso":"🇧🇫", Ghana:"🇬🇭", Kenya:"🇰🇪",
      Senegal:"🇸🇳", Tanzania:"🇹🇿"
    };
    return map[name] || "🌍";
  } catch {
    return "🌍";
  }
}

/* ================= /START ================= */

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!(await isJoined(userId))) {
    return bot.sendMessage(chatId, "❌ Join required channels", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Join Channel", url: "https://t.me/mrchd112" }],
          [{ text: "Join Group", url: "https://t.me/mrchandiootpgroup" }],
          [{ text: "✅ Verify", callback_data: "verify_join" }]
        ]
      }
    });
  }

  loadCountries(chatId, userId);
});

/* ================= VERIFY ================= */

bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  if (q.data === "verify_join") {
    if (!(await isJoined(userId))) {
      return bot.answerCallbackQuery(q.id, {
        text: "Join channels first ❌",
        show_alert: true
      });
    }
    return loadCountries(chatId, userId);
  }

  if (q.data.startsWith("country_")) {
    const country = q.data.replace("country_", "");
    userState.set(userId, { country });
    return assignNumber(chatId, userId);
  }

  if (q.data === "change_number") {
    return assignNumber(chatId, userId);
  }

  if (q.data === "change_country") {
    return loadCountries(chatId, userId);
  }
});

/* ================= LOAD COUNTRIES (AUTO) ================= */

async function loadCountries(chatId, userId) {
  try {
    const { data } = await axios.get(NUMBERS_API);
    const rows = data.aaData || [];

    const countries = [
      ...new Set(rows.map(r => cleanCountry(r[0])).filter(Boolean))
    ];

    if (!countries.length) {
      return bot.sendMessage(chatId, "❌ No countries available");
    }

    const keyboard = countries.map(c => ([
      { text: `${countryFlag(c)} ${c}`, callback_data: `country_${c}` }
    ]));

    bot.sendMessage(chatId, "🌍 Select Country:", {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (e) {
    console.log(e);
  }
}

/* ================= ASSIGN NUMBER ================= */

async function assignNumber(chatId, userId) {
  try {
    const state = userState.get(userId);
    if (!state) return;

    const { data } = await axios.get(NUMBERS_API);
    const rows = data.aaData || [];

    const filtered = rows.filter(
      r => cleanCountry(r[0]) === state.country
    );

    if (!filtered.length) {
      return bot.sendMessage(chatId, "❌ No number available");
    }

    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    const number = "+" + String(pick[2]).replace(/\D/g,"");

    userState.set(userId, {
      country: state.country,
      number
    });

    bot.sendMessage(chatId,
`📱 *Your Number (${state.country})*
${countryFlag(state.country)} ${number}

⏳ Waiting for OTP…`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔁 Change Number", callback_data: "change_number" }],
            [{ text: "🌍 Change Country", callback_data: "change_country" }],
            [{ text: "📢 OTP Group", url: "https://t.me/mrchandiootpgroup" }]
          ]
        }
      });

  } catch (e) {
    console.log(e);
  }
}

/* ================= OTP LOOP ================= */

setInterval(async () => {
  try {
    const { data } = await axios.get(SMS_API);
    const rows = data.aaData || [];

    for (const r of rows) {
      const number = "+" + String(r[2]).replace(/\D/g,"");
      const msg = r[4];

      for (const [uid, st] of userState.entries()) {
        if (st.number === number) {
          bot.sendMessage(uid, `🔑 *OTP RECEIVED*\n\n${msg}`, {
            parse_mode: "Markdown"
          });
        }
      }

      bot.sendMessage(
        OTP_GROUP_ID,
`📩 *New OTP*
📞 ${number.replace(/(\d{4})\d+(\d{3})/,"$1****$2")}
🔑 ${msg}`,
        { parse_mode: "Markdown" }
      );
    }
  } catch {}
}, 3000);
