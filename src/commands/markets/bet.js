const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { buildMarketEmbed } = require('../../utils/marketEmbed');
const { deductCoins } = require('../../utils/currency');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bet')
    .setDescription('Place a bet on an open market')
    .addIntegerOption(o => o
      .setName('market')
      .setDescription('Market ID (use /markets to see open markets)')
      .setRequired(true)
      .setMinValue(1)
    )
    .addIntegerOption(o => o
      .setName('outcome')
      .setDescription('Outcome number to bet on')
      .setRequired(true)
      .setMinValue(1)
    )
    .addIntegerOption(o => o
      .setName('amount')
      .setDescription('Amount of coins to bet')
      .setRequired(true)
      .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const marketId   = interaction.options.getInteger('market');
    const outcomeNum = interaction.options.getInteger('outcome');
    const amount     = interaction.options.getInteger('amount');

    // ─── Validate market ──────────────────────────────────────────────────────
    const market = db.getMarket(marketId);
    if (!market) {
      return interaction.editReply(`❌ Market #${marketId} does not exist.`);
    }
    if (market.guild_id !== interaction.guildId) {
      return interaction.editReply(`❌ That market is not from this server.`);
    }
    if (market.status !== 'open') {
      return interaction.editReply(`❌ Market #${marketId} is **${market.status}** — betting is closed.`);
    }

    // ─── Validate outcome ─────────────────────────────────────────────────────
    const outcomes = db.getMarketOutcomes(marketId);
    const outcome = outcomes.find(o => o.id === outcomeNum);
    if (!outcome) {
      const valid = outcomes.map(o => `**${o.id}** — ${o.label}`).join('\n');
      return interaction.editReply(`❌ Invalid outcome number. Valid options:\n${valid}`);
    }

    // ─── Check for duplicate bet ──────────────────────────────────────────────
    const existing = db.getUserBet(marketId, interaction.user.id);
    if (existing) {
      const existingOutcome = outcomes.find(o => o.id === existing.outcome_id);
      return interaction.editReply(
        `❌ You already bet **🪙 ${existing.amount.toLocaleString()}** on **${existingOutcome?.label}** in this market. One bet per market.`
      );
    }

    // ─── Deduct coins immediately (also validates balance) ────────────────────
    try {
      await deductCoins(interaction.guildId, interaction.user.id, amount);
    } catch (err) {
      if (err.message === 'INSUFFICIENT_FUNDS') {
        return interaction.editReply(
          `❌ You don't have enough coins. You need **🪙 ${amount.toLocaleString()}** but only have **🪙 ${err.balance.toLocaleString()}**.`
        );
      }
      console.error('Currency API error on bet placement:', err);
      return interaction.editReply('❌ Could not reach the currency API. Please try again later.');
    }

    // ─── Save bet to DB ───────────────────────────────────────────────────────
    db.placeBet({
      marketId,
      outcomeId: outcome.id,
      userId: interaction.user.id,
      amount,
    });

    // ─── Refresh the market embed ─────────────────────────────────────────────
    const updatedMarket = db.getMarket(marketId);
    const embed = buildMarketEmbed(updatedMarket, outcomes);

    if (market.message_id) {
      try {
        const channel = await interaction.client.channels.fetch(market.channel_id);
        const msg = await channel.messages.fetch(market.message_id);
        await msg.edit({ embeds: [embed] });
      } catch { /* original message deleted — ignore */ }
    }

    await interaction.editReply(
      `✅ Bet placed! You wagered **🪙 ${amount.toLocaleString()}** on **${outcome.label}** in Market #${marketId}.`
    );
  },
};
