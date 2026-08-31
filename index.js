const {
    Client,
    GatewayIntentBits
} = require("discord.js");

const {
    Player,
    QueryType
} = require("discord-player");

const {
    DefaultExtractors
} = require("@discord-player/extractor");

require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const player = new Player(client);

const PREFIX = ".";

const BAD_WORDS = [
    "remix",
    "cover",
    "live",
    "slowed",
    "slowed reverb",
    "sped up",
    "speed up",
    "nightcore",
    "reverb",
    "instrumental",
    "karaoke",
    "8d",
    "edit",
    "bootleg",
    "mashup"
];

function wantsSpecialVersion(query) {
    const q = query.toLowerCase();
    return BAD_WORDS.some(word => q.includes(word));
}

function cleanQuery(query) {
    return query
        .replace(/\bremix\b/gi, "")
        .replace(/\bcover\b/gi, "")
        .replace(/\blive\b/gi, "")
        .replace(/\bslowed reverb\b/gi, "")
        .replace(/\bslowed\b/gi, "")
        .replace(/\bsped up\b/gi, "")
        .replace(/\bspeed up\b/gi, "")
        .replace(/\bnightcore\b/gi, "")
        .replace(/\breverb\b/gi, "")
        .replace(/\binstrumental\b/gi, "")
        .replace(/\bkaraoke\b/gi, "")
        .replace(/\b8d\b/gi, "")
        .replace(/\bedit\b/gi, "")
        .replace(/\bbootleg\b/gi, "")
        .replace(/\bmashup\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

// =========================
// PLAYER DEBUG
// =========================

player.on("debug", (message) => {
    console.log(`[PLAYER] ${message}`);
});

player.events.on("debug", (queue, message) => {
    console.log(`[QUEUE] ${message}`);
});

player.events.on("error", (queue, error) => {
    console.error("[PLAYER ERROR]", error);
});

player.events.on("playerError", (queue, error) => {
    console.error("[PLAYER ERROR]", error);
});

// =========================
// READY
// =========================

client.once("ready", async () => {
    try {
        await player.extractors.loadMulti(DefaultExtractors);
        console.log("Extractors loaded successfully");
    } catch (error) {
        console.error("Extractor loading error:", error);
    }

    console.log(`Bot is online as ${client.user.tag}`);
});

// =========================
// MESSAGE
// =========================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);

    const command = args.shift()?.toLowerCase();

    // =========================
    // PLAY
    // =========================

    if (command === "play" || command === "p") {

        let query = args.join(" ").trim();

        if (!query) {
            return message.reply(
                "🎵 اكتب اسم الأغنية، مثال:\n`.play Believer Imagine Dragons`"
            );
        }

        const voiceChannel = message.member?.voice?.channel;

        if (!voiceChannel) {
            return message.reply(
                "❌ ادخل Voice Channel الأول."
            );
        }

        const specialVersion = wantsSpecialVersion(query);

        if (!specialVersion) {
            query = cleanQuery(query);
        }

        try {

            await message.channel.send(
                `🔎 بدور على: **${query}**`
            );

            console.log(`[SEARCH] ${query}`);

            // البحث باستخدام SoundCloud
            const result = await player.search(query, {
                requestedBy: message.author,
                searchEngine: QueryType.SOUNDCLOUD
            });

            console.log(
                `[SEARCH RESULT] ${result?.tracks?.length || 0} tracks`
            );

            if (!result || !result.tracks.length) {
                return message.reply(
                    "❌ ملقتش نتيجة مناسبة للأغنية."
                );
            }

            let tracks = result.tracks;

            // استبعاد النسخ غير الأصلية
            if (!specialVersion) {

                const filtered = tracks.filter(track => {

                    const title =
                        `${track.title} ${track.author?.name || ""}`
                        .toLowerCase();

                    return !BAD_WORDS.some(word =>
                        title.includes(word)
                    );
                });

                if (filtered.length > 0) {
                    tracks = filtered;
                }
            }

            const track = tracks[0];

            console.log(`[TRACK] ${track.title}`);
            console.log(`[TRACK URL] ${track.url}`);

            const queue = player.nodes.create(message.guild, {

                metadata: {
                    channel: message.channel,
                    requestedBy: message.author
                },

                leaveOnEnd: false,
                leaveOnStop: false,
                leaveOnEmpty: true

            });

            // الاتصال بالروم
            if (!queue.connection) {

                console.log(
                    `[VOICE] Connecting to ${voiceChannel.name}`
                );

                await queue.connect(voiceChannel);

                console.log(
                    "[VOICE] Connected successfully"
                );
            }

            // إضافة الأغنية
            await queue.addTrack(track);

            console.log(
                `[QUEUE] Track added: ${track.title}`
            );

            // تشغيل الأغنية
            if (!queue.isPlaying()) {

                console.log(
                    "[PLAYER] Starting playback..."
                );

                await queue.node.play();

                console.log(
                    "[PLAYER] Playback started"
                );
            }

            return message.reply(
                `🎵 **${track.title}**\n` +
                `👤 ${track.author?.name || "Unknown"}\n` +
                `🔊 تمت إضافتها للتشغيل`
            );

        } catch (error) {

            console.error(
                "================ PLAY ERROR ================"
            );

            console.error(error);

            console.error(
                "============================================"
            );

            return message.reply(
                "❌ حصل خطأ أثناء تشغيل الأغنية."
            );
        }
    }

    // =========================
    // SKIP
    // =========================

    if (command === "skip" || command === "s") {

        const queue =
            player.nodes.get(message.guild.id);

        if (!queue || !queue.isPlaying()) {
            return message.reply(
                "❌ مفيش أغنية شغالة."
            );
        }

        try {

            await queue.node.skip();

            return message.reply(
                "⏭️ تم تخطي الأغنية."
            );

        } catch (error) {

            console.error(error);

            return message.reply(
                "❌ مقدرتش أعمل Skip."
            );
        }
    }

    // =========================
    // STOP
    // =========================

    if (command === "stop") {

        const queue =
            player.nodes.get(message.guild.id);

        if (!queue) {
            return message.reply(
                "❌ مفيش تشغيل حالي."
            );
        }

        try {

            queue.delete();

            return message.reply(
                "⏹️ تم إيقاف الموسيقى."
            );

        } catch (error) {

            console.error(error);

            return message.reply(
                "❌ حصل خطأ أثناء الإيقاف."
            );
        }
    }

    // =========================
    // PAUSE
    // =========================

    if (command === "pause") {

        const queue =
            player.nodes.get(message.guild.id);

        if (!queue || !queue.isPlaying()) {
            return message.reply(
                "❌ مفيش أغنية شغالة."
            );
        }

        queue.node.pause();

        return message.reply(
            "⏸️ تم إيقاف الأغنية مؤقتًا."
        );
    }

    // =========================
    // RESUME
    // =========================

    if (command === "resume") {

        const queue =
            player.nodes.get(message.guild.id);

        if (!queue) {
            return message.reply(
                "❌ مفيش Queue."
            );
        }

        queue.node.resume();

        return message.reply(
            "▶️ كملنا تشغيل."
        );
    }

    // =========================
    // NOW PLAYING
    // =========================

    if (command === "now" || command === "np") {

        const queue =
            player.nodes.get(message.guild.id);

        if (!queue || !queue.currentTrack) {
            return message.reply(
                "❌ مفيش أغنية شغالة."
            );
        }

        const track =
            queue.currentTrack;

        return message.reply(
            `🎵 **دلوقتي شغال:**\n` +
            `**${track.title}**\n` +
            `👤 ${track.author?.name || "Unknown"}`
        );
    }

    // =========================
    // QUEUE
    // =========================

    if (command === "queue" || command === "q") {

        const queue =
            player.nodes.get(message.guild.id);

        if (!queue || !queue.tracks.size) {
            return message.reply(
                "📭 الـQueue فاضية."
            );
        }

        const tracks =
            queue.tracks
                .toArray()
                .slice(0, 10)
                .map(
                    (track, index) =>
                        `${index + 1}. ${track.title}`
                )
                .join("\n");

        return message.reply(
            `📋 **Queue:**\n${tracks}`
        );
    }
});

// =========================
// LOGIN
// =========================

if (!process.env.DISCORD_TOKEN) {
    console.error(
        "❌ DISCORD_TOKEN مش موجود في Railway Variables"
    );

    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
