const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { buildMarketEmbed } = require('../../utils/marketEmbed');
const { addCoins } = require('../../utils/currency');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market-cancel')
    .setDescription('Cancel a market and refund all bets')
    .addIntegerOption(o => o
      .setName('market')
      .setDescription('Market ID to cancel')
      .setRequired(true)
      .setMinValue(1)
    ),

  async execute(interaction) {
    if (!await requireMod(interaction)) return;

    await interaction.deferReply();

    const marketId = interaction.options.getInteger('market');
    const market   = db.getMarket(marketId);

    if (!market || market.guild_id !== interaction.guildId) {
      return interaction.editReply('❌ Market not found.');
    }
    if (market.status === 'resolved' || market.status === 'cancelled') {
      return interaction.editReply(`❌ Market #${marketId} is already **${market.status}**.`);
    }

    const allBets = db.getMarketBets(marketId);
    db.cancelMarket(marketId);

    const refunds = [];
    const errors  = [];

    for (const bet of allBets) {
      try {
        await addCoins(interaction.guildId, bet.user_id, bet.amount);
        refunds.push({ userId: bet.user_id, amount: bet.amount });
      } catch (err) {
        console.error(`Failed to refund user ${bet.user_id}:`, err);
        errors.push({ userId: bet.user_id, amount: bet.amount });
      }
    }

    const outcomes        = db.getMarketOutcomes(marketId);
    const cancelledMarket = db.getMarket(marketId);
    const embed           = buildMarketEmbed(cancelledMarket, outcomes);

    if (market.message_id) {
      try {
        const channel = await interaction.client.channels.fetch(market.channel_id);
        const msg     = await channel.messages.fetch(market.message_id);
        await msg.edit({ embeds: [embed] });
      } catch { /* deleted */ }
    }

    const refundLines = refunds.length > 0
      ? refunds.map(r => `<@${r.userId}> → 🪙 ${r.amount.toLocaleString()} refunded ✅`).join('\n')
      : '_No bets to refund._';

    const errorLines = errors.length > 0
      ? `\n\n⚠️ **Failed to refund (manual action needed):**\n` +
        errors.map(e => `<@${e.userId}> — 🪙 ${e.amount.toLocaleString()}`).join('\n')
      : '';

    await interaction.editReply([
      `## ❌ Market #${marketId} Cancelled`,
      `**Question:** ${market.question}`,
      '',
      '**Refunds:**',
      refundLines,
      errorLines,
    ].join('\n'));
  },
};
