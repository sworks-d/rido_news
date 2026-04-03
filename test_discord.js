// Discord接続確認スクリプト
// 実行方法: node test_discord.js

import { Client, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

const channels = {
  alert: process.env.DISCORD_CHANNEL_ALERT,
  briefing: process.env.DISCORD_CHANNEL_BRIEFING,
  daily: process.env.DISCORD_CHANNEL_DAILY,
  status: process.env.DISCORD_CHANNEL_STATUS,
};

client.once('clientReady', async () => {
  console.log(`✅ Bot起動完了: ${client.user.tag}`);

  for (const [name, id] of Object.entries(channels)) {
    try {
      const channel = await client.channels.fetch(id);
      await channel.send(`【接続確認】#${name} チャンネルへの送信テスト成功 ✅`);
      console.log(`✅ ${name} (${id}): 送信成功`);
    } catch (err) {
      console.error(`❌ ${name} (${id}): 送信失敗 - ${err.message}`);
    }
  }

  console.log('\n全チャンネルの確認が完了しました。');
  client.destroy();
  process.exit(0);
});

client.on('error', (err) => {
  console.error('❌ Bot接続エラー:', err.message);
  process.exit(1);
});

client.login(process.env.DISCORD_BOT_TOKEN);
